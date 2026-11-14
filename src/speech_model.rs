//! The Qwen3-ASR model on disk. A fresh Mac or PC doesn't have it, so Pointo checks and downloads
//! it in the background at launch (`local_asr::install`) instead of during the first capture.
//! Onboarding and Settings show how that's going (`current`).
//!
//! A capture that finishes without a model says so in its summary (`TranscriptData::missing`,
//! from `missing`). When the reason can pass (still downloading, a failed download), the bundle
//! gets a `.transcript-pending` marker, and once the model is installed it's transcribed again
//! in place: `pointo.json` and `summary.md` are rewritten with the transcript.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use anyhow::{Context, Result};
use serde::Serialize;

use crate::model::MissingTranscript;

/// A language id such as `zh-TW` (`_` becomes `-`), or `None` for Automatic (`auto`, blank) and
/// anything that isn't shaped like one. Qwen3-ASR reads the part before the first `-`.
pub fn language_id(value: &str) -> Option<String> {
    let value = value.trim();
    let shaped = value.starts_with(|c: char| c.is_ascii_alphabetic())
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    (shaped && !value.eq_ignore_ascii_case("auto")).then(|| value.replace('_', "-"))
}

/// Marks a bundle that should be transcribed again once the model is installed.
pub const PENDING: &str = ".transcript-pending";

/// Waits between failed installs; after the last one it stops until the next launch.
const RETRY_AFTER: [Duration; 3] = [
    Duration::from_secs(60),
    Duration::from_secs(5 * 60),
    Duration::from_secs(30 * 60),
];

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum State {
    /// Not checked yet.
    #[default]
    Unknown,
    Checking,
    Downloading,
    Ready,
    Failed,
}

/// What onboarding and Settings show.
#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub state: State,
    /// 0…1 while downloading.
    pub progress: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// One report from `local_asr::install`.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ModelLine {
    /// `downloading`, `installed` or `failed`.
    pub status: String,
    pub progress: Option<f64>,
    pub error: Option<String>,
}

#[derive(Default)]
struct Worker {
    status: Status,
    running: bool,
}

impl Worker {
    /// Whether a new check should start now.
    fn request(&mut self) -> bool {
        if self.running || self.status.state == State::Ready {
            return false;
        }
        self.running = true;
        true
    }

    fn apply(&mut self, line: &ModelLine) {
        let s = &mut self.status;
        s.state = match line.status.as_str() {
            "installed" => State::Ready,
            "failed" => State::Failed,
            _ => State::Downloading,
        };
        s.progress = line.progress.unwrap_or(s.progress);
        s.error = line.error.clone();
    }
}

static WORKER: Mutex<Worker> = Mutex::new(Worker {
    status: Status {
        state: State::Unknown,
        progress: 0.0,
        error: None,
    },
    running: false,
});

fn lock() -> MutexGuard<'static, Worker> {
    WORKER
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

pub fn current() -> Status {
    lock().status.clone()
}

/// Checks the model in the background and downloads it if it's missing, unless a check is
/// already running or it's ready. Cheap to call again.
pub fn ensure() {
    let mut worker = lock();
    if !worker.request() {
        return;
    }
    let spawned = std::thread::Builder::new()
        .name("pointo-speech-model".into())
        .spawn(|| {
            work();
            lock().running = false;
        });
    if spawned.is_err() {
        worker.running = false;
    }
}

fn work() {
    for attempt in 0..=RETRY_AFTER.len() {
        {
            let mut worker = lock();
            if worker.status.state != State::Downloading {
                worker.status.state = State::Checking;
            }
        }
        let result = crate::local_asr::install(|line| lock().apply(&line));
        let status = {
            let mut worker = lock();
            if let Err(error) = result {
                worker.status.state = State::Failed;
                worker.status.error = Some(format!("{error:#}"));
            }
            worker.status.clone()
        };
        crate::capture::scrawl_log(format!(
            "speech model: {:?}{}",
            status.state,
            status
                .error
                .as_ref()
                .map(|e| format!(" ({e})"))
                .unwrap_or_default()
        ));
        if status.state == State::Ready {
            transcribe_pending(&crate::handoff::default_captures_dir());
            return;
        }
        if let Some(wait) = RETRY_AFTER.get(attempt) {
            std::thread::sleep(*wait);
        }
    }
}

/// The plain sentence for a capture without a transcript, for `why` (`downloading` or `failed`).
pub fn missing(why: &str, error: Option<&str>) -> MissingTranscript {
    let model = format!("The {} speech model", crate::local_asr::ENGINE_TITLE);
    match why {
        "downloading" => MissingTranscript {
            reason: format!(
                "{model} was still downloading. The audio is saved, and Pointo adds the \
                 transcript to this bundle when the download finishes."
            ),
            retry: true,
        },
        _ => MissingTranscript {
            reason: format!(
                "{model} couldn't be installed{}. The audio is saved, and Pointo adds the \
                 transcript to this bundle if a later try works.",
                error.map(|e| format!(" ({e})")).unwrap_or_default()
            ),
            retry: true,
        },
    }
}

/// Marks a freshly written bundle whose transcript can come later; if the model has arrived
/// meanwhile, transcribes it now.
pub fn mark_pending(bundle_dir: &Path) {
    let _ = std::fs::write(bundle_dir.join(PENDING), b"");
    if current().state == State::Ready {
        let dir = bundle_dir.to_path_buf();
        std::thread::spawn(move || transcribe_one(&dir));
    }
}

/// Every marked bundle in `captures`.
pub fn transcribe_pending(captures: &Path) {
    let Ok(entries) = std::fs::read_dir(captures) else {
        return;
    };
    let pending: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|dir| dir.join(PENDING).is_file())
        .collect();
    for dir in pending {
        transcribe_one(&dir);
    }
}

fn transcribe_one(dir: &Path) {
    match transcribe_again(dir) {
        Ok(done) => crate::capture::scrawl_log(format!(
            "transcribed again {}: {}",
            dir.display(),
            if done { "done" } else { "still no model" }
        )),
        Err(error) => {
            crate::capture::scrawl_log(format!(
                "transcribing {} again failed: {error:#}",
                dir.display()
            ));
            let _ = std::fs::remove_file(dir.join(PENDING));
        }
    }
}

/// Transcribes a bundle's `audio.wav` with Qwen3-ASR (the model it was waiting for) and rewrites
/// its transcript, each keyframe's words, `pointo.json` and `summary.md`. Returns `false` (and
/// keeps the marker) while there's still no model.
pub fn transcribe_again(dir: &Path) -> Result<bool> {
    let (dir, mut bundle) = crate::handoff::load_bundle(dir)?;
    let wav = dir.join(bundle.audio.as_deref().unwrap_or("audio.wav"));
    anyhow::ensure!(wav.is_file(), "the bundle has no audio.wav any more");
    let transcript = crate::local_asr::transcribe(&wav)?;
    if transcript
        .missing
        .as_ref()
        .is_some_and(|missing| missing.retry)
    {
        return Ok(false);
    }
    let times: Vec<u64> = bundle.keyframes.iter().map(|k| k.t).collect();
    let said = crate::keyframes::said_per_keyframe(&times, &[], &transcript);
    for (frame, said) in bundle.keyframes.iter_mut().zip(said) {
        frame.said = said;
    }
    bundle.transcript = transcript;
    std::fs::write(
        dir.join("pointo.json"),
        serde_json::to_vec_pretty(&bundle).context("Could not encode pointo.json")?,
    )?;
    std::fs::write(
        dir.join("summary.md"),
        crate::sketch::summary_markdown(&bundle, &dir),
    )?;
    let _ = std::fs::remove_file(dir.join(PENDING));
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(status: &str) -> ModelLine {
        ModelLine {
            status: status.into(),
            ..Default::default()
        }
    }

    #[test]
    fn a_check_runs_once_at_a_time_and_stops_when_the_model_is_ready() {
        let mut w = Worker::default();
        assert!(w.request());
        assert!(!w.request(), "already running");
        w.apply(&line("downloading"));
        assert_eq!(w.status.state, State::Downloading);
        w.running = false;
        assert!(w.request(), "a failed or interrupted check can start again");
        let mut failed = line("failed");
        failed.error = Some("offline".into());
        w.apply(&failed);
        assert_eq!(w.status.state, State::Failed);
        assert_eq!(w.status.error.as_deref(), Some("offline"));
        w.apply(&line("installed"));
        assert_eq!(w.status.state, State::Ready);
        assert_eq!(w.status.error, None);
        w.running = false;
        assert!(!w.request(), "nothing to do once it's ready");
    }

    #[test]
    fn progress_survives_lines_without_one() {
        let mut w = Worker::default();
        let mut half = line("downloading");
        half.progress = Some(0.5);
        w.apply(&half);
        w.apply(&line("downloading"));
        assert_eq!(w.status.progress, 0.5);
    }

    #[test]
    fn language_ids_are_plain_ids_and_auto_is_none() {
        assert_eq!(language_id(" zh-CN ").as_deref(), Some("zh-CN"));
        assert_eq!(language_id("zh_Hant_TW").as_deref(), Some("zh-Hant-TW"));
        assert_eq!(language_id("yue").as_deref(), Some("yue"));
        for automatic_or_bad in ["", "auto", "AUTO", "zh-TW --install", "../x", "-zh", "中文"] {
            assert_eq!(language_id(automatic_or_bad), None, "{automatic_or_bad:?}");
        }
    }

    #[test]
    fn a_download_in_progress_and_a_failed_one_are_both_retried() {
        let downloading = missing("downloading", None);
        assert!(downloading.retry);
        assert!(downloading.reason.contains("still downloading"));
        let failed = missing("failed", Some("no space left"));
        assert!(failed.retry && failed.reason.contains("(no space left)"));
    }
}
