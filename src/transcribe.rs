//! Transcription: Qwen3-ASR on this computer by default (`crate::local_asr`, Mandarin, Cantonese
//! and English; word times estimated). Alternatives: Apple's SpeechAnalyzer through
//! `pointo-helper` on macOS (`"transcriber": "apple"`, measured word timings), Hex when
//! `"transcriber": "hex"` is set and Hex is connected (`crate::hex`), or a program of the user's
//! when `"transcriber": "command"` (`crate::command_transcriber`). Any trouble with those falls
//! back to Qwen3-ASR for that recording.

use std::path::Path;
use std::sync::atomic::{AtomicU8, Ordering};

use anyhow::Result;

use crate::audio::RecordedAudio;
use crate::model::TranscriptData;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Engine {
    #[default]
    Qwen,
    Apple,
    Hex,
    Command,
}

impl Engine {
    pub fn parse(name: &str) -> Option<Self> {
        match name.trim().to_ascii_lowercase().as_str() {
            "qwen" => Some(Self::Qwen),
            "apple" if cfg!(target_os = "macos") => Some(Self::Apple),
            // Windows' local engine used to be called "apple" in the config.
            "apple" => Some(Self::Qwen),
            "hex" => Some(Self::Hex),
            "command" => Some(Self::Command),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Qwen => "qwen",
            Self::Apple => "apple",
            Self::Hex => "hex",
            Self::Command => "command",
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
            1 => Self::Apple,
            2 => Self::Hex,
            3 => Self::Command,
            4 => Self::Qwen,
            _ => Self::configured(),
        }
    }
}

/// The default engine's name in menus and logs.
pub const LOCAL_ENGINE_TITLE: &str = crate::local_asr::ENGINE_TITLE;
/// Apple's SpeechAnalyzer, the macOS alternative.
pub const APPLE_ENGINE_TITLE: &str = "Apple Speech";

static OVERRIDE: AtomicU8 = AtomicU8::new(0);
static LOGGED_NOT_CONNECTED: std::sync::Once = std::sync::Once::new();
static LOGGED_NO_COMMAND: std::sync::Once = std::sync::Once::new();

/// What the Settings window's Transcription controls show. A Hex preference stays saved while Hex
/// is away, but the active choice follows what recordings would really use.
#[derive(Debug, PartialEq, Eq)]
pub struct MenuState {
    pub hex_title: &'static str,
    pub hex_enabled: bool,
    pub hex_checked: bool,
    /// Ready Hex models as `(id, title, chosen)`, empty when Hex is away.
    pub models: Vec<(String, String, bool)>,
}

pub fn menu_state(
    preferred: Engine,
    status: Option<&crate::hex::Status>,
    configured_model: Option<&str>,
) -> MenuState {
    let Some(status) = status else {
        return MenuState {
            hex_title: "Hex (not running)",
            hex_enabled: false,
            hex_checked: false,
            models: Vec::new(),
        };
    };
    let chosen = crate::hex::pick_model(&status.models, configured_model);
    let models: Vec<_> = status
        .usable_models()
        .map(|model| {
            let title = if model.name.is_empty() {
                &model.id
            } else {
                &model.name
            };
            (
                model.id.clone(),
                title.clone(),
                chosen.as_deref() == Some(model.id.as_str()),
            )
        })
        .collect();
    let ready = chosen.is_some();
    MenuState {
        hex_title: if ready { "Hex" } else { "Hex (no model ready)" },
        hex_enabled: ready,
        hex_checked: ready && preferred == Engine::Hex,
        models,
    }
}

/// Pins the engine for this process (`pointo reprocess --transcriber`).
pub fn set_override(engine: Engine) {
    OVERRIDE.store(
        match engine {
            Engine::Apple => 1,
            Engine::Hex => 2,
            Engine::Command => 3,
            Engine::Qwen => 4,
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
    let live = audio.live.take();
    let engine = Engine::preferred();
    run(
        engine,
        || match engine {
            Engine::Qwen => Ok(None),
            Engine::Apple => Ok(live
                .and_then(|live| finish_live(live, audio))
                .or_else(|| apple(wav))),
            Engine::Hex => try_hex(audio),
            Engine::Command => try_command(wav, audio),
        },
        || local(wav),
    )
}

/// The transcript made while recording, or `None` (logged) to transcribe the WAV instead.
fn finish_live(
    live: crate::live_transcribe::Live,
    audio: &RecordedAudio,
) -> Option<TranscriptData> {
    match live.finish(&audio.wav_bytes) {
        Ok(done) => {
            crate::capture::scrawl_log(format!(
                "Live transcription: {} words, {} of {} ms streamed, tail {} ms",
                done.transcript.words.len(),
                done.streamed_samples as u64 * 1_000 / 16_000,
                audio.duration_ms,
                done.tail_ms
            ));
            Some(done.transcript)
        }
        Err(error) => {
            crate::capture::scrawl_log(format!(
                "Live transcription failed, transcribing the recording: {error:#}"
            ));
            None
        }
    }
}

/// The preferred engine when it isn't the local model, with the local model as the answer to
/// anything it can't do. `other` returns `Ok(None)` when that engine isn't there at all (no Apple
/// speech model, Hex not connected or without a ready model, no usable `transcribeCommand`).
fn run(
    engine: Engine,
    other: impl FnOnce() -> Result<Option<TranscriptData>>,
    local: impl FnOnce() -> TranscriptData,
) -> TranscriptData {
    let name = match engine {
        Engine::Qwen => return local(),
        Engine::Apple => APPLE_ENGINE_TITLE,
        Engine::Hex => "Hex",
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

fn try_hex(audio: &RecordedAudio) -> Result<Option<TranscriptData>> {
    let not_connected = |reason: String| {
        LOGGED_NOT_CONNECTED.call_once(|| {
            crate::capture::scrawl_log(format!(
                "Hex preferred but unavailable ({reason}); using {LOCAL_ENGINE_TITLE}"
            ));
        });
        Ok(None)
    };
    let client = match crate::hex::Client::connect() {
        Ok(client) => client,
        Err(error) => return not_connected(format!("{error:#}")),
    };
    let models = client.models()?;
    let configured = crate::handoff::hex_model();
    let Some(model) = crate::hex::pick_model(&models, configured.as_deref()) else {
        return not_connected("no ready model".into());
    };
    crate::hex::transcribe_audio(&client, &model, &crate::handoff::hex_language(), audio).map(Some)
}

/// Apple's SpeechAnalyzer (macOS), or `None` when it can't transcribe this recording.
#[cfg(target_os = "macos")]
fn apple(wav: &Path) -> Option<TranscriptData> {
    match crate::helper::transcribe(wav) {
        Ok(transcript) if transcript.missing.is_none() => Some(transcript),
        Ok(transcript) => {
            if let Some(missing) = transcript.missing {
                crate::capture::scrawl_log(format!("{APPLE_ENGINE_TITLE}: {}", missing.reason));
            }
            None
        }
        Err(error) => {
            crate::capture::scrawl_log(format!("{APPLE_ENGINE_TITLE} failed: {error:#}"));
            None
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn apple(_wav: &Path) -> Option<TranscriptData> {
    None
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
        assert_eq!(Engine::parse("hex"), Some(Engine::Hex));
        assert_eq!(Engine::parse("Command"), Some(Engine::Command));
        assert_eq!(Engine::parse("whisper"), None);
        assert_eq!(Engine::default(), Engine::Qwen);
        // Windows has no Apple speech: an old "apple" setting means the local model there.
        let apple = if cfg!(target_os = "macos") { Engine::Apple } else { Engine::Qwen };
        assert_eq!(Engine::parse("apple"), Some(apple));
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
    fn the_preferred_engine_is_used_when_it_answers() {
        for (engine, source) in [
            (Engine::Apple, "speech-analyzer"),
            (Engine::Hex, "hex:parakeet_v3"),
            (Engine::Command, "command:whisper-pointo"),
        ] {
            let result = run(
                engine,
                || Ok(Some(named(source))),
                || panic!("the local model must not be asked"),
            );
            assert_eq!(result.source, source);
        }
    }

    #[test]
    fn an_unavailable_or_failing_engine_falls_back_to_the_local_model() {
        for engine in [Engine::Apple, Engine::Hex, Engine::Command] {
            let local = || named("qwen:Qwen3-ASR-0.6B-Q8_0");
            assert_eq!(run(engine, || Ok(None), local).source, "qwen:Qwen3-ASR-0.6B-Q8_0");
            let failed = run(engine, || Err(anyhow::anyhow!("took too long")), local);
            assert_eq!(failed.source, "qwen:Qwen3-ASR-0.6B-Q8_0");
        }
    }

    #[test]
    fn menu_follows_what_recordings_would_use() {
        use crate::hex::{Model, Status};
        let status = |models: Vec<Model>| Status {
            version: "2.2.0".into(),
            models,
        };
        let ready = |id: &str, name: &str| Model {
            id: id.into(),
            name: name.into(),
            installed: true,
            verified: true,
        };

        let away = menu_state(Engine::Hex, None, None);
        assert!(!away.hex_checked && !away.hex_enabled);
        assert_eq!(away.hex_title, "Hex (not running)");

        let up = status(vec![
            ready("parakeet_v3", "Parakeet v3"),
            ready("qwen3_asr06_b", ""),
        ]);
        let hex = menu_state(Engine::Hex, Some(&up), Some("qwen3_asr06_b"));
        assert!(hex.hex_checked && hex.hex_enabled);
        assert_eq!(
            hex.models,
            vec![
                ("parakeet_v3".into(), "Parakeet v3".into(), false),
                ("qwen3_asr06_b".into(), "qwen3_asr06_b".into(), true),
            ]
        );
        let apple = menu_state(Engine::Apple, Some(&up), None);
        assert!(!apple.hex_checked && apple.hex_enabled);

        let empty = status(vec![Model {
            id: "parakeet_v3".into(),
            name: String::new(),
            installed: false,
            verified: false,
        }]);
        let none = menu_state(Engine::Hex, Some(&empty), None);
        assert!(!none.hex_checked && !none.hex_enabled && none.models.is_empty());
        assert_eq!(none.hex_title, "Hex (no model ready)");
    }

    #[test]
    fn no_audio_is_none_without_asking_any_engine() {
        assert_eq!(transcribe(None, None).source, "none");
    }
}
