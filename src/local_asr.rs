//! On-device transcription, the default engine on macOS and Windows: Alibaba's Qwen3-ASR 0.6B
//! (Mandarin, Cantonese, English and code-switching between them, plus 27 more languages) through
//! `transcribe.cpp`, the engine Hex uses (Metal on macOS, ggml's CPU backends on Windows).
//!
//! The model is the same file, revision and checksum as Hex's `QWEN_ARTIFACT`. It loads a copy
//! Hex has already installed when there is one, else Pointo's own (`own_models_dir`), which
//! `install` downloads once in the background and checks against its SHA-256: first from
//! hf-mirror.com (reachable from mainland China), then from huggingface.co.
//!
//! It transcribes each speech island on its own. Qwen3-ASR gives no word
//! times, so each island's words are spread across it by length (`TranscriptData::estimated`):
//! they land in the right island but not on the right syllable, so spoken cues never cut
//! keyframes from them.

use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{Context, Result, bail};
use transcribe_cpp::{Model, RunOptions, TimestampKind};

use crate::speech_model::ModelLine;
use crate::model::{TranscriptData, TranscriptSegment, WordTiming};

const KHZ: u64 = 16;
/// Silence kept around each clip, so first and last words aren't clipped.
const CLIP_PAD_MS: u64 = 200;
/// What Settings and the summary call the engine.
pub const ENGINE_TITLE: &str = "Qwen3-ASR";

/// A model file Pointo can download and check.
pub struct Artifact {
    pub filename: &'static str,
    /// Tried in order until one finishes.
    pub urls: &'static [&'static str],
    pub bytes: u64,
    pub sha256: &'static str,
}

pub const QWEN3_ASR: Artifact = Artifact {
    filename: "Qwen3-ASR-0.6B-Q8_0.gguf",
    urls: &[
        "https://hf-mirror.com/handy-computer/Qwen3-ASR-0.6B-gguf/resolve/e4e16599b900eb0cb36e524514756bb92eb092b7/Qwen3-ASR-0.6B-Q8_0.gguf",
        "https://huggingface.co/handy-computer/Qwen3-ASR-0.6B-gguf/resolve/e4e16599b900eb0cb36e524514756bb92eb092b7/Qwen3-ASR-0.6B-Q8_0.gguf",
    ],
    bytes: 850_423_456,
    sha256: "f081b2d5e23bd669d92cc331d722a8a0681943b8e6f34b48996fd5c319b5acd8",
};

/// Where Pointo keeps the model it downloaded (`POINTO_MODELS_DIR` for tests):
/// `~/Library/Application Support/pointo/models`, `%LOCALAPPDATA%\Pointo\models`.
pub fn own_models_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("POINTO_MODELS_DIR").filter(|dir| !dir.is_empty()) {
        return PathBuf::from(dir);
    }
    #[cfg(target_os = "windows")]
    let base = crate::win::local_dir();
    #[cfg(not(target_os = "windows"))]
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pointo");
    base.join("models")
}

fn receipt_path(model: &Path) -> PathBuf {
    model.with_file_name(format!(
        "{}.verified.json",
        model.file_name().unwrap_or_default().to_string_lossy()
    ))
}

/// `.gguf` files in `dir` that have a `.verified.json` receipt beside them.
fn verified_in(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut found: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| {
            path.extension().is_some_and(|ext| ext == "gguf") && receipt_path(path).is_file()
        })
        .collect();
    found.sort();
    found
}

fn is_qwen(path: &Path) -> bool {
    path.file_name()
        .is_some_and(|name| name.to_string_lossy().to_ascii_lowercase().starts_with("qwen3-asr"))
}

/// Qwen3-ASR models ready to load: Pointo's own download first, then any Hex has installed
/// (`hex`, then the older `voice-control` folder).
pub fn installed_models() -> Vec<PathBuf> {
    let mut models: Vec<PathBuf> = verified_in(&own_models_dir())
        .into_iter()
        .filter(|path| is_qwen(path))
        .collect();
    for support in crate::speech_text::support_dirs() {
        models.extend(
            verified_in(&support.join("models"))
                .into_iter()
                .filter(|path| is_qwen(path)),
        );
    }
    models
}

/// The model's name for `TranscriptData.model`: its file name without the extension.
fn model_name(path: &Path) -> String {
    path.file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// The language to ask for: Settings › Recording › Language (`language`, `zh-CN` → `zh`), or
/// `None` to let the model tell (Mandarin, Cantonese and English mixed in one recording).
pub fn language() -> Option<String> {
    crate::handoff::language().and_then(|locale| language_from_locale(&locale))
}

fn language_from_locale(locale: &str) -> Option<String> {
    let code = locale.split(['-', '_']).next()?.trim().to_ascii_lowercase();
    (!code.is_empty() && code.bytes().all(|b| b.is_ascii_alphabetic())).then_some(code)
}

pub fn transcribe(audio: &Path) -> Result<TranscriptData> {
    let Some(path) = installed_models().into_iter().next() else {
        // The background download hasn't finished (or failed): the bundle is transcribed again
        // once it has.
        let status = crate::speech_model::current();
        let why = match status.state {
            crate::speech_model::State::Failed => "failed",
            _ => "downloading",
        };
        return Ok(TranscriptData {
            source: "offline".into(),
            missing: Some(crate::speech_model::missing(why, status.error.as_deref())),
            ..Default::default()
        });
    };
    let wav =
        std::fs::read(audio).with_context(|| format!("Could not read {}", audio.display()))?;
    let samples = crate::audio::decode_wav_16k(&wav)?;
    transcribe_samples(&path, &samples)
}

/// Transcribes 16 kHz mono `samples` with the model at `path`.
pub fn transcribe_samples(path: &Path, samples: &[f32]) -> Result<TranscriptData> {
    let duration_ms = samples.len() as u64 / KHZ;
    let mut clips = crate::speech_text::plan_clips(&crate::audio::speech_islands(samples), duration_ms);
    if clips.is_empty() && duration_ms >= 480 {
        clips.push((0, duration_ms));
    }
    let name = model_name(path);
    let mut transcript = TranscriptData {
        source: format!("qwen:{name}"),
        model: Some(name),
        estimated: false,
        ..Default::default()
    };
    if clips.is_empty() {
        return Ok(transcript);
    }

    init_backends()?;
    let model = Model::load(path).with_context(|| format!("Could not load {}", path.display()))?;
    let mut session = model.session()?;
    // The richest timing the model has: word times where it can (Parakeet, Whisper), plain text
    // from Qwen3-ASR, whose words are then spread over each clip.
    let options = RunOptions {
        timestamps: TimestampKind::Auto,
        language: language(),
        ..Default::default()
    };
    let mut texts = Vec::new();
    for (start, end) in clips {
        let from_ms = start.saturating_sub(CLIP_PAD_MS);
        let from = (from_ms * KHZ) as usize;
        let to = (((end + CLIP_PAD_MS) * KHZ) as usize).min(samples.len());
        if from >= to {
            continue;
        }
        let result = session.run(&samples[from..to], &options)?;
        let text = result.text.split_whitespace().collect::<Vec<_>>().join(" ");
        if text.is_empty() {
            continue;
        }
        let at = |ms: i64| from_ms + ms.max(0) as u64;
        let words: Vec<WordTiming> = result
            .words
            .iter()
            .filter(|word| !word.text.trim().is_empty())
            .map(|word| WordTiming {
                t0: at(word.t0_ms),
                t1: at(word.t1_ms.max(word.t0_ms)),
                text: word.text.trim().to_owned(),
            })
            .collect();
        if words.is_empty() {
            // No word times from this model: spread the text over the clip, and say so.
            let (segments, words) = crate::speech_text::spread_words(&text, start, end);
            transcript.estimated = true;
            transcript.segments.extend(segments);
            transcript.words.extend(words);
        } else {
            transcript.segments.push(TranscriptSegment {
                t0: words[0].t0,
                t1: words[words.len() - 1].t1,
                text: text.clone(),
            });
            transcript.words.extend(words);
        }
        texts.push(text);
    }
    transcript.text = crate::speech_text::join_tokens(texts.iter().map(String::as_str));
    Ok(transcript)
}

/// Windows loads ggml's CPU backend DLL for this CPU (beside `transcribe.dll`), once per process:
/// the registry it fills isn't safe to change while another thread loads a model. macOS links
/// the Metal and CPU backends in, so there's nothing to load.
fn init_backends() -> Result<()> {
    static INIT: std::sync::OnceLock<std::result::Result<(), String>> = std::sync::OnceLock::new();
    INIT.get_or_init(|| {
        transcribe_cpp::disable_logging();
        #[cfg(target_os = "windows")]
        return transcribe_cpp::init_backends_default().map_err(|error| format!("{error:#}"));
        #[cfg(not(target_os = "windows"))]
        Ok(())
    })
    .clone()
    .map_err(|error| anyhow::anyhow!("transcribe.cpp backends: {error}"))
}

/// Makes sure a model is on disk: `installed` when Pointo's or Hex's is there, else downloads
/// `QWEN3_ASR` into `own_models_dir()`, reporting progress, and keeps it only if its SHA-256
/// matches.
pub fn install(mut line: impl FnMut(ModelLine)) -> Result<()> {
    let report = |status: &str, progress: Option<f64>, error: Option<String>| ModelLine {
        status: status.into(),
        progress,
        error,
    };
    if installed_models().is_empty() {
        let mut progress = |done: f64| line(report("downloading", Some(done), None));
        if let Err(error) = download(&QWEN3_ASR, &own_models_dir(), &mut progress) {
            line(report("failed", None, Some(format!("{error:#}"))));
            return Ok(());
        }
    }
    line(report("installed", Some(1.0), None));
    Ok(())
}

/// Downloads `artifact` into `dir` (resuming a `.partial` file, trying each URL in turn), checks
/// it, and writes the `.verified.json` receipt that `installed_models` looks for. A file that
/// fails the check is deleted, so the next try starts over.
pub fn download(artifact: &Artifact, dir: &Path, progress: &mut dyn FnMut(f64)) -> Result<PathBuf> {
    std::fs::create_dir_all(dir).with_context(|| format!("Could not create {}", dir.display()))?;
    let model = dir.join(artifact.filename);
    if !model.is_file() {
        let partial = dir.join(format!("{}.partial", artifact.filename));
        if std::fs::metadata(&partial).map_or(0, |m| m.len()) < artifact.bytes {
            let mut errors = Vec::new();
            let fetched = artifact.urls.iter().any(|url| {
                match fetch(url, &partial, artifact.bytes, progress) {
                    Ok(()) => true,
                    Err(error) => {
                        errors.push(format!("{error:#}"));
                        false
                    }
                }
            });
            if !fetched {
                bail!("{}", errors.join("; "));
            }
        }
        std::fs::rename(&partial, &model)?;
    }
    if let Err(error) = verify(&model, artifact) {
        let _ = std::fs::remove_file(&model);
        return Err(error);
    }
    let receipt = serde_json::json!({
        "sha256": artifact.sha256,
        "bytes": artifact.bytes,
        "urls": artifact.urls,
    });
    std::fs::write(receipt_path(&model), receipt.to_string())?;
    Ok(model)
}

fn verify(path: &Path, artifact: &Artifact) -> Result<()> {
    use sha2::{Digest, Sha256};
    let len = std::fs::metadata(path)?.len();
    if len != artifact.bytes {
        bail!(
            "{} is {len} bytes, expected {}",
            artifact.filename,
            artifact.bytes
        );
    }
    let mut hasher = Sha256::new();
    std::io::copy(&mut std::fs::File::open(path)?, &mut hasher)?;
    let sha256 = format!("{:x}", hasher.finalize());
    if sha256 != artifact.sha256 {
        bail!("{} failed its checksum ({sha256})", artifact.filename);
    }
    Ok(())
}

/// The system's `curl` (macOS `/usr/bin/curl`; Windows' own `curl.exe`, in System32 since
/// Windows 10 1803, without a console window).
fn curl() -> std::process::Command {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let exe = std::env::var_os("SystemRoot")
            .map_or_else(|| PathBuf::from(r"C:\Windows"), PathBuf::from)
            .join(r"System32\curl.exe");
        let mut command = std::process::Command::new(exe);
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }
    #[cfg(not(target_os = "windows"))]
    std::process::Command::new("/usr/bin/curl")
}

fn fetch(url: &str, partial: &Path, total: u64, progress: &mut dyn FnMut(f64)) -> Result<()> {
    use std::io::Read;
    let mut child = curl()
        .args([
            "--fail",
            "--location",
            "--silent",
            "--show-error",
            "--retry",
            "3",
            "--connect-timeout",
            "15",
            "--continue-at",
            "-",
            "--output",
        ])
        .arg(partial)
        .arg(url)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .context("Could not run curl")?;
    loop {
        if let Some(status) = child.try_wait()? {
            if status.success() {
                progress(1.0);
                return Ok(());
            }
            let mut error = String::new();
            if let Some(mut stderr) = child.stderr.take() {
                let _ = stderr.read_to_string(&mut error);
            }
            bail!("the download failed ({status}): {}", error.trim());
        }
        let have = std::fs::metadata(partial).map_or(0, |m| m.len());
        progress((have as f64 / total as f64).min(0.99));
        std::thread::sleep(Duration::from_millis(500));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A five-byte artifact whose checksum is `sha256("hello")`.
    const HELLO: Artifact = Artifact {
        filename: "fixture.gguf",
        urls: &["http://127.0.0.1:9/never-fetched"],
        bytes: 5,
        sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    };

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("pointo-speech-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_finished_download_that_matches_gets_a_receipt_and_counts_as_installed() {
        let dir = temp_dir("good");
        std::fs::write(dir.join("fixture.gguf.partial"), b"hello").unwrap();
        let model = download(&HELLO, &dir, &mut |_| {}).unwrap();
        assert_eq!(model, dir.join("fixture.gguf"));
        assert!(receipt_path(&model).is_file());
        assert_eq!(verified_in(&dir), vec![model]);
    }

    #[test]
    fn a_download_that_fails_its_checksum_is_deleted_and_not_installed() {
        let dir = temp_dir("bad");
        std::fs::write(dir.join("fixture.gguf.partial"), b"hellp").unwrap();
        let error = download(&HELLO, &dir, &mut |_| {}).unwrap_err();
        assert!(format!("{error:#}").contains("checksum"));
        assert!(!dir.join("fixture.gguf").exists());
        assert!(verified_in(&dir).is_empty());
    }

    #[test]
    fn every_url_is_tried_and_all_failures_are_reported() {
        const NOWHERE: Artifact = Artifact {
            filename: "nowhere.gguf",
            urls: &["http://127.0.0.1:9/a", "http://127.0.0.1:9/b"],
            bytes: 5,
            sha256: HELLO.sha256,
        };
        let dir = temp_dir("nowhere");
        let error = format!("{:#}", download(&NOWHERE, &dir, &mut |_| {}).unwrap_err());
        assert_eq!(error.matches("the download failed").count(), 2, "{error}");
    }

    #[test]
    fn the_default_model_is_qwen_from_the_china_mirror_first() {
        assert!(QWEN3_ASR.filename.starts_with("Qwen3-ASR"));
        assert!(QWEN3_ASR.urls[0].starts_with("https://hf-mirror.com/"));
        assert!(QWEN3_ASR.urls[1].starts_with("https://huggingface.co/"));
        assert!(is_qwen(Path::new("/m/Qwen3-ASR-0.6B-Q8_0.gguf")));
        assert!(!is_qwen(Path::new("/m/parakeet-unified-en-0.6b-Q8_0.gguf")));
    }

    #[test]
    fn locales_become_language_codes_and_junk_is_automatic() {
        assert_eq!(language_from_locale("zh-CN").as_deref(), Some("zh"));
        assert_eq!(language_from_locale("yue_HK").as_deref(), Some("yue"));
        assert_eq!(language_from_locale("en").as_deref(), Some("en"));
        assert_eq!(language_from_locale(""), None);
        assert_eq!(language_from_locale("12"), None);
    }

    /// Downloads the real model (850 MB), loads it and runs it on two seconds of sound. CI's
    /// Windows release job runs it, then again under Intel SDE as a CPU without AVX-512 (#58),
    /// with `POINTO_TEST_MODEL_DIR` keeping the download between the two.
    #[test]
    #[ignore]
    fn downloads_and_runs_qwen() {
        let kept = std::env::var_os("POINTO_TEST_MODEL_DIR").map(PathBuf::from);
        let dir = kept.clone().unwrap_or_else(|| temp_dir("qwen"));
        let fresh = !dir.join(QWEN3_ASR.filename).is_file();
        let mut last = 0.0;
        let model = download(&QWEN3_ASR, &dir, &mut |done| last = done).unwrap();
        if fresh {
            assert_eq!(last, 1.0);
        }
        #[cfg(target_arch = "x86_64")]
        if std::env::var_os("POINTO_TEST_NO_AVX512").is_some() {
            // Under SDE: proves the emulated CPU is the one without AVX-512.
            assert!(!std::arch::is_x86_feature_detected!("avx512f"));
        }
        init_backends().unwrap();
        for device in transcribe_cpp::devices() {
            eprintln!("device: {} ({})", device.name, device.description);
        }
        let pcm: Vec<f32> = (0..32_000)
            .map(|i| (i as f32 * 440.0 * std::f32::consts::TAU / 16_000.0).sin() * 0.1)
            .collect();
        Model::load(&model)
            .unwrap()
            .session()
            .unwrap()
            .run(&pcm, &RunOptions::default())
            .unwrap();
        if kept.is_none() {
            let _ = std::fs::remove_dir_all(&dir);
        }
    }

    /// Runs the real model on a recording: `POINTO_TEST_QWEN=<model.gguf> POINTO_TEST_WAV=<16 kHz
    /// wav> cargo test runs_qwen -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn runs_qwen_on_a_recording() {
        let model = PathBuf::from(std::env::var_os("POINTO_TEST_QWEN").expect("POINTO_TEST_QWEN"));
        let wav = std::fs::read(std::env::var_os("POINTO_TEST_WAV").expect("POINTO_TEST_WAV"))
            .unwrap();
        let samples = crate::audio::decode_wav_16k(&wav).unwrap();
        let transcript = transcribe_samples(&model, &samples).unwrap();
        eprintln!("text: {}", transcript.text);
        for segment in &transcript.segments {
            eprintln!("[{}–{} ms] {}", segment.t0, segment.t1, segment.text);
        }
        assert!(!transcript.text.trim().is_empty());
    }
}
