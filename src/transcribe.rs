//! Transcription: Qwen3-ASR on this computer (`crate::local_asr`, Mandarin, Cantonese and
//! English; word times estimated), or a program of the user's when `"transcriber": "command"`
//! (`crate::command_transcriber`). Any trouble with the program falls back to Qwen3-ASR for that
//! recording. Old `"apple"` and `"hex"` settings mean Qwen3-ASR.

use std::path::Path;
use std::sync::atomic::{AtomicU8, Ordering};

use anyhow::Result;

use crate::audio::RecordedAudio;
use crate::model::TranscriptData;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Engine {
    #[default]
    Qwen,
    Command,
}

impl Engine {
    pub fn parse(name: &str) -> Option<Self> {
        match name.trim().to_ascii_lowercase().as_str() {
            // Engines Pointo used to offer (Apple Speech, Hex) are Qwen3-ASR now.
            "qwen" | "apple" | "hex" => Some(Self::Qwen),
            "command" => Some(Self::Command),
            _ => None,
        }
    }

    /// The configured engine: `"transcriber"` in the config file, Qwen3-ASR when missing or unknown.
    pub fn configured() -> Self {
        crate::handoff::transcriber()
            .as_deref()
            .and_then(Self::parse)
            .unwrap_or_default()
    }

    /// What recordings use now: a command-line `--transcriber`, else the configured engine.
    pub fn preferred() -> Self {
        match OVERRIDE.load(Ordering::Relaxed) {
            1 => Self::Command,
            2 => Self::Qwen,
            _ => Self::configured(),
        }
    }
}

/// The engine's name in menus and logs.
pub const LOCAL_ENGINE_TITLE: &str = crate::local_asr::ENGINE_TITLE;

static OVERRIDE: AtomicU8 = AtomicU8::new(0);
static LOGGED_NO_COMMAND: std::sync::Once = std::sync::Once::new();

/// Pins the engine for this process (`pointo reprocess --transcriber`).
pub fn set_override(engine: Engine) {
    OVERRIDE.store(
        match engine {
            Engine::Command => 1,
            Engine::Qwen => 2,
        },
        Ordering::Relaxed,
    );
}

/// Missing microphones and a failed transcriber never prevent saving a bundle.
pub fn transcribe(wav: Option<&Path>, audio: Option<&RecordedAudio>) -> TranscriptData {
    let (Some(wav), Some(audio)) = (wav, audio.filter(|audio| audio.sample_count > 0)) else {
        return TranscriptData {
            source: "none".into(),
            ..Default::default()
        };
    };
    let engine = Engine::preferred();
    run(
        engine,
        || match engine {
            Engine::Qwen => Ok(None),
            Engine::Command => try_command(wav, audio),
        },
        || local(wav),
    )
}

/// The preferred engine when it isn't the local model, with the local model as the answer to
/// anything it can't do. `other` returns `Ok(None)` when that engine isn't there at all (no
/// usable `transcribeCommand`).
fn run(
    engine: Engine,
    other: impl FnOnce() -> Result<Option<TranscriptData>>,
    local: impl FnOnce() -> TranscriptData,
) -> TranscriptData {
    let name = match engine {
        Engine::Qwen => return local(),
        Engine::Command => "Command",
    };
    match other() {
        Ok(Some(transcript)) => return transcript,
        Ok(None) => {}
        Err(error) => crate::capture::scrawl_log(format!(
            "{name} transcription failed, using {LOCAL_ENGINE_TITLE}: {error:#}"
        )),
    }
    local()
}

/// Runs `transcribeCommand`. Its errors are fixed reasons (`command_transcriber::Failure`),
/// never what the program printed or was given.
fn try_command(wav: &Path, audio: &RecordedAudio) -> Result<Option<TranscriptData>> {
    let program = match crate::handoff::transcribe_command() {
        Ok(program) => program,
        Err(unusable) => {
            LOGGED_NO_COMMAND.call_once(|| {
                crate::capture::scrawl_log(format!(
                    "Command transcriber preferred but {unusable}; using {LOCAL_ENGINE_TITLE}"
                ));
            });
            return Ok(None);
        }
    };
    let transcript =
        crate::command_transcriber::transcribe(&program, wav, audio.sample_count, &mut |line| {
            crate::capture::scrawl_log(line)
        })?;
    Ok(Some(transcript))
}

/// Qwen3-ASR on this computer. Without a model yet (still downloading), the bundle is marked to
/// be transcribed again once it's there.
fn local(wav: &Path) -> TranscriptData {
    let transcript = crate::local_asr::transcribe(wav).unwrap_or_else(|error| {
        crate::capture::scrawl_log(format!("{LOCAL_ENGINE_TITLE} failed: {error:#}"));
        TranscriptData {
            source: "offline".into(),
            missing: Some(crate::model::MissingTranscript {
                reason: format!("{LOCAL_ENGINE_TITLE} failed ({error:#})."),
                retry: false,
            }),
            ..Default::default()
        }
    });
    if let Some(missing) = &transcript.missing {
        crate::capture::scrawl_log(format!("No transcript: {}", missing.reason));
        if missing.retry {
            crate::speech_model::ensure();
        }
    }
    transcript
}

#[cfg(test)]
mod tests {
    use super::*;

    fn named(source: &str) -> TranscriptData {
        TranscriptData {
            source: source.into(),
            ..Default::default()
        }
    }

    #[test]
    fn engine_names_parse_and_unknown_is_not_an_engine() {
        assert_eq!(Engine::parse("qwen"), Some(Engine::Qwen));
        assert_eq!(Engine::parse("Command"), Some(Engine::Command));
        assert_eq!(Engine::parse("whisper"), None);
        assert_eq!(Engine::default(), Engine::Qwen);
    }

    #[test]
    fn engines_that_were_removed_are_qwen() {
        for old in ["apple", "Apple", "hex", " HEX "] {
            assert_eq!(Engine::parse(old), Some(Engine::Qwen), "{old:?}");
        }
    }

    #[test]
    fn the_local_model_never_asks_another_engine() {
        let result = run(
            Engine::Qwen,
            || panic!("no other engine may be asked"),
            || named("qwen:Qwen3-ASR-0.6B-Q8_0"),
        );
        assert_eq!(result.source, "qwen:Qwen3-ASR-0.6B-Q8_0");
    }

    #[test]
    fn the_command_is_used_when_it_answers() {
        let result = run(
            Engine::Command,
            || Ok(Some(named("command:whisper-pointo"))),
            || panic!("the local model must not be asked"),
        );
        assert_eq!(result.source, "command:whisper-pointo");
    }

    #[test]
    fn an_unavailable_or_failing_command_falls_back_to_the_local_model() {
        let local = || named("qwen:Qwen3-ASR-0.6B-Q8_0");
        assert_eq!(run(Engine::Command, || Ok(None), local).source, "qwen:Qwen3-ASR-0.6B-Q8_0");
        let failed = run(Engine::Command, || Err(anyhow::anyhow!("took too long")), local);
        assert_eq!(failed.source, "qwen:Qwen3-ASR-0.6B-Q8_0");
    }

    #[test]
    fn no_audio_is_none_without_asking_any_engine() {
        assert_eq!(transcribe(None, None).source, "none");
    }
}
