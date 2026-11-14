use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, bail, ensure};
use serde::Deserialize;

use crate::model::ScrawlBundle;

/// Where captures go: `SCRAWL_CAPTURES_DIR`, else `"capturesDir"` in `config.json` (Settings ›
/// Storage), else `builtin_captures_dir`. Tests never see the config file.
pub fn default_captures_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("SCRAWL_CAPTURES_DIR") {
        return PathBuf::from(dir);
    }
    let configured = if cfg!(test) {
        None
    } else {
        config().captures_dir
    };
    configured
        .as_deref()
        .and_then(configured_captures_dir)
        .filter(|dir| usable_captures_dir(dir))
        .unwrap_or_else(builtin_captures_dir)
}

/// A chosen folder that exists (or can be made) and takes writes; otherwise it's logged once and the
/// built-in folder is used, so a capture is never lost to a missing or unplugged drive.
fn usable_captures_dir(dir: &Path) -> bool {
    let usable = fs::create_dir_all(dir).is_ok()
        && fs::metadata(dir).is_ok_and(|meta| meta.is_dir() && !meta.permissions().readonly());
    if !usable {
        log_config_once(format!(
            "config.json: \"capturesDir\" {} can't be used (missing or not writable); captures go to {}",
            dir.display(),
            builtin_captures_dir().display()
        ));
    }
    usable
}

/// A `"capturesDir"` value as a folder: `~` is the home folder, and only an absolute path counts
/// (anything else is logged and skipped, so captures never land relative to the app's cwd).
pub fn configured_captures_dir(value: &str) -> Option<PathBuf> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }
    let path = match value.strip_prefix('~') {
        Some(rest) if rest.is_empty() || rest.starts_with(['/', '\\']) => {
            dirs::home_dir()?.join(rest.trim_start_matches(['/', '\\']))
        }
        _ => PathBuf::from(value),
    };
    if path.is_absolute() {
        Some(path)
    } else {
        log_config_once(format!(
            "config.json: ignoring \"capturesDir\": {value} is not an absolute path"
        ));
        None
    }
}

/// `~/Library/Application Support/pointo/captures` on macOS, `%LOCALAPPDATA%\pointo\captures`
/// on Windows (local, not roaming: the movies are large).
pub fn builtin_captures_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("pointo")
            .join("captures")
    } else {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library/Application Support/pointo/captures")
    }
}

/// Opens a file, folder or URL with its default app (Finder, Explorer, the browser).
pub fn open_path(target: &Path) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        crate::win::shell::open(target)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let status = Command::new("/usr/bin/open").arg(target).status()?;
        ensure!(status.success(), "open {} failed", target.display());
        Ok(())
    }
}

/// Shows a file selected in Finder or Explorer.
pub fn reveal_path(target: &Path) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        crate::win::shell::reveal(target)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("/usr/bin/open")
            .arg("-R")
            .arg(target)
            .spawn()?;
        Ok(())
    }
}

pub fn resolve_bundle_dir(path_or_id: &Path) -> Result<PathBuf> {
    if path_or_id == Path::new("latest") {
        return newest_bundle(&default_captures_dir());
    }
    let mut path = path_or_id.to_owned();
    if path.file_name().is_some_and(|name| name == "pointo.json") {
        path = path
            .parent()
            .context("Missing bundle directory")?
            .to_owned();
        if path.as_os_str().is_empty() {
            path = PathBuf::from(".");
        }
    }
    if !path.exists() && path.components().count() == 1 {
        path = default_captures_dir().join(&path);
        if path.extension().is_none() {
            path.set_extension("pointo");
        }
    }
    ensure!(
        path.is_dir(),
        "Bundle directory not found: {}",
        path.display()
    );
    let path = plain_path(
        path.canonicalize()
            .with_context(|| format!("Could not resolve {}", path.display()))?,
    );
    ensure!(
        path.extension().is_some_and(|ext| ext == "pointo"),
        "Expected a .pointo directory: {}",
        path.display()
    );
    Ok(path)
}

fn newest_bundle(captures: &Path) -> Result<PathBuf> {
    let mut candidates = Vec::new();
    for entry in
        fs::read_dir(captures).with_context(|| format!("Could not read {}", captures.display()))?
    {
        let entry = entry?;
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "pointo") && path.is_dir() {
            // Bundle creation time is stable even after later zoom-frame extraction.
            let created = fs::read(path.join("pointo.json"))
                .ok()
                .and_then(|bytes| serde_json::from_slice::<ScrawlBundle>(&bytes).ok())
                .map(|bundle| bundle.created_at_ms)
                .unwrap_or_else(|| {
                    entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.created().or_else(|_| m.modified()).ok())
                        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                        .map_or(0, |time| time.as_millis() as u64)
                });
            candidates.push((created, path));
        }
    }
    candidates.sort_unstable();
    candidates
        .pop()
        .context("No .pointo captures found")?
        .1
        .canonicalize()
        .map(plain_path)
        .map_err(Into::into)
}

/// `canonicalize` on Windows returns `\\?\C:\…`; agents and terminals want `C:\…`.
fn plain_path(path: PathBuf) -> PathBuf {
    match path.to_str().and_then(|p| p.strip_prefix(r"\\?\")) {
        Some(rest) if rest.as_bytes().get(1) == Some(&b':') => PathBuf::from(rest),
        _ => path,
    }
}

pub fn load_bundle(bundle_dir: &Path) -> Result<(PathBuf, ScrawlBundle)> {
    let directory = resolve_bundle_dir(bundle_dir)?;
    let path = directory.join("pointo.json");
    let bundle = serde_json::from_slice(
        &fs::read(&path).with_context(|| format!("Could not read {}", path.display()))?,
    )
    .with_context(|| format!("Invalid bundle manifest: {}", path.display()))?;
    Ok((directory, bundle))
}

#[cfg(target_os = "macos")]
pub fn copy_string_to_clipboard(content: &str) -> Result<()> {
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypeString};
    use objc2_foundation::{NSArray, NSString};

    let text = NSString::from_str(content);
    let pasteboard = NSPasteboard::generalPasteboard();
    unsafe {
        let types = NSArray::from_slice(&[NSPasteboardTypeString]);
        pasteboard.clearContents();
        pasteboard.declareTypes_owner(&types, None);
        ensure!(
            pasteboard.setString_forType(&text, NSPasteboardTypeString),
            "Could not copy text to clipboard"
        );
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn copy_png_to_clipboard(png_bytes: &[u8]) -> Result<()> {
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypePNG};
    use objc2_foundation::{NSArray, NSData};

    let data = NSData::with_bytes(png_bytes);
    let pasteboard = NSPasteboard::generalPasteboard();
    unsafe {
        let types = NSArray::from_slice(&[NSPasteboardTypePNG]);
        pasteboard.clearContents();
        pasteboard.declareTypes_owner(&types, None);
        ensure!(
            pasteboard.setData_forType(Some(&data), NSPasteboardTypePNG),
            "Could not copy PNG image to clipboard"
        );
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn copy_string_to_clipboard(content: &str) -> Result<()> {
    crate::win::clipboard::set_text(content)
}

#[cfg(target_os = "windows")]
pub fn copy_png_to_clipboard(png_bytes: &[u8]) -> Result<()> {
    crate::win::clipboard::set_png(png_bytes)
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
pub fn copy_bundle_to_clipboard(bundle_dir: &Path) -> Result<()> {
    let (directory, bundle) = load_bundle(bundle_dir)?;
    let summary = crate::sketch::summary_markdown(&bundle, &directory);
    #[cfg(target_os = "windows")]
    if experiment("clipboardImage")
        && let Ok(image) = fs::read(directory.join(&bundle.contact_sheet))
        && crate::win::clipboard::set_png_and_text(&image, Some(&summary)).is_ok()
    {
        return Ok(());
    }
    copy_string_to_clipboard(&summary)
}

/// Pastes both the contact-sheet image and the transcript/keyframe text into the active app
/// as a two-step sequence (`⌘V` image, then `⌘V` text; Ctrl+V on Windows). If `click_target` is
/// provided (from dragging the Paste chip onto a window/input), clicks at that screen coordinate
/// first to focus it.
#[cfg(any(target_os = "macos", target_os = "windows"))]
pub fn paste_bundle_at_target(bundle_dir: &Path, click_target: Option<[f32; 2]>) -> Result<()> {
    if let Some([x, y]) = click_target {
        crate::capture::post_synthetic_click(f64::from(x), f64::from(y));
        std::thread::sleep(std::time::Duration::from_millis(65));
    } else {
        crate::capture::ensure_external_app_active();
    }
    paste_bundle_image_and_text(bundle_dir)
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
pub fn paste_bundle_image_and_text(bundle_dir: &Path) -> Result<()> {
    let (directory, bundle) = load_bundle(bundle_dir)?;
    let sheet_path = directory.join(&bundle.contact_sheet);
    let image = fs::read(&sheet_path).context("Could not read contact sheet")?;
    let summary = crate::sketch::summary_markdown(&bundle, &directory);

    crate::capture::wait_for_modifiers_released(350);

    if crate::capture::is_frontmost_terminal() {
        // In terminals (Ghostty / Codex / Claude Code), pasting the image path first
        // resolves and attaches `[Image 1]`, and the second paste inserts the text summary.
        copy_string_to_clipboard(&sheet_path.display().to_string())?;
    } else {
        // In GUI apps (Slack, Linear, browsers), PNG-only attaches the image.
        copy_png_to_clipboard(&image)?;
    }
    std::thread::sleep(std::time::Duration::from_millis(20));
    crate::capture::post_synthetic_cmd_v();

    std::thread::sleep(std::time::Duration::from_millis(160));
    copy_string_to_clipboard(&summary)?;
    std::thread::sleep(std::time::Duration::from_millis(20));
    crate::capture::post_synthetic_cmd_v();
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn copy_bundle_to_clipboard(_bundle_dir: &Path) -> Result<()> {
    bail!("Image and text clipboard handoff requires macOS or Windows")
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn paste_bundle_image_and_text(_bundle_dir: &Path) -> Result<()> {
    bail!("Image and text paste handoff requires macOS or Windows")
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn paste_bundle_at_target(_bundle_dir: &Path, _click_target: Option<[f32; 2]>) -> Result<()> {
    bail!("Image and text paste handoff requires macOS or Windows")
}

fn executable(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(path).is_ok_and(|metadata| metadata.permissions().mode() & 0o111 != 0)
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// `name` on `PATH`. On Windows `name.exe` and `name.cmd` (npm and bun shims) count too.
pub(crate) fn on_path(name: &str) -> Option<PathBuf> {
    let names: Vec<String> = if cfg!(windows) && Path::new(name).extension().is_none() {
        vec![
            format!("{name}.exe"),
            format!("{name}.cmd"),
            name.to_owned(),
        ]
    } else {
        vec![name.to_owned()]
    };
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .flat_map(|path| names.iter().map(move |name| path.join(name)))
            .find(|path| executable(path))
    })
}

#[derive(Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default)]
    pub ingest_token: Option<String>,
    #[serde(default, alias = "tetherApps")]
    pub usb_apps: Vec<String>,
    /// `false` turns Screen-capture auto-crop off; an object overrides its settings.
    #[serde(default)]
    pub autocrop: Option<serde_json::Value>,
    /// `false` keeps Mac captures on the clipboard instead of delivering them to the project
    /// they were of (`routing`); an explicit pick still delivers.
    #[serde(default)]
    pub auto_send: Option<bool>,
    /// Feature flag: shows **Export Last Capture as Video…** in the menu (default off).
    #[serde(default)]
    pub video_export: Option<bool>,
    /// `"qwen"` (default) or `"command"` (`"apple"` and `"hex"` mean `"qwen"`): which engine transcribes recordings
    /// (`transcribe`). The command's own keys are read by `transcribe_command`, not here, so a
    /// malformed one can't reset this struct.
    #[serde(default)]
    pub transcriber: Option<String>,
    /// Lower the output volume while recording (`playback`) to `playbackLevel` percent of it.
    #[serde(default)]
    pub lower_playback: Option<bool>,
    #[serde(default)]
    pub playback_level: Option<u8>,
    /// The spoken language for Qwen3-ASR (`"zh-CN"`, `"yue"`, `"en-US"`, `"auto"`); missing means
    /// the model tells. Configs written before Pointo dropped Apple Speech call it `appleLocale`.
    #[serde(default, alias = "appleLocale")]
    pub language: Option<String>,
    /// Whether to use the native Metal recording pill instead of GPUI's `HudPillWindow` (default `true`).
    #[serde(default)]
    pub native_pill: Option<bool>,
    /// Visual style of the native recording pill: `"black"` (default) or `"glass"` (`NSGlassEffectView`).
    #[serde(default)]
    pub pill_style: Option<String>,
    /// Behaviour Kit tries locally before it ships (`{"agentContext": true}`); see `experiment`.
    /// Read leniently (`lenient_experiments`), so a stray value never fails the file.
    #[serde(default, deserialize_with = "lenient_experiments")]
    pub experiments: std::collections::BTreeMap<String, bool>,
    /// The microphone Mac captures record from (`mic`); absent follows the macOS default.
    #[serde(default)]
    pub microphone: Option<crate::mic::Choice>,
    /// Where new captures go (`default_captures_dir`); absent keeps the built-in folder.
    #[serde(default)]
    pub captures_dir: Option<String>,
    /// The project folder every capture goes to (absolute, `~` allowed), when the user pinned
    /// one; absent means the page, port or terminal decides (`routing`).
    #[serde(default)]
    pub project: Option<String>,
    /// Folders captures were delivered to, most recent first (`project::push_recent`).
    #[serde(default)]
    pub recent_projects: Vec<String>,
}

impl Config {
    /// The output volume while recording when `lowerPlayback` is on, in percent of what it was.
    pub fn recording_volume(&self) -> u8 {
        self.playback_level.unwrap_or(20).min(100)
    }
}

/// `true`/`false`, `"yes"`/`"on"`/`"1"` and their opposites, or a number (non-zero is on). Other
/// values are skipped and logged once, as is an `experiments` that isn't an object.
fn lenient_experiments<'de, D>(
    deserializer: D,
) -> std::result::Result<std::collections::BTreeMap<String, bool>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde_json::Value;
    let value = Value::deserialize(deserializer)?;
    let mut out = std::collections::BTreeMap::new();
    let Value::Object(map) = value else {
        if !value.is_null() {
            log_config_once(format!(
                "config.json: ignoring \"experiments\": {value} (expected an object)"
            ));
        }
        return Ok(out);
    };
    for (name, value) in map {
        let on = match &value {
            Value::Bool(b) => Some(*b),
            Value::Number(n) => n.as_f64().map(|n| n != 0.0),
            Value::String(s) => match s.trim().to_ascii_lowercase().as_str() {
                "true" | "yes" | "on" | "1" => Some(true),
                "false" | "no" | "off" | "0" | "" => Some(false),
                _ => None,
            },
            _ => None,
        };
        match on {
            Some(on) => {
                out.insert(name, on);
            }
            None => log_config_once(format!(
                "config.json: ignoring experiment \"{name}\": {value} (expected true or false)"
            )),
        }
    }
    Ok(out)
}

/// Config problems are logged once per process, not on every read.
fn log_config_once(message: String) {
    static SEEN: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());
    let mut seen = SEEN
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if !seen.contains(&message) {
        crate::capture::scrawl_log(&message);
        seen.push(message);
    }
}

/// More of what Pointo already knows in the summary: marks, shortcuts, drags and windows inline
/// at their time, numbered marks on shared frames, where a screen changed.
pub const AGENT_CONTEXT: &str = "agentContext";

static EXPERIMENT_OVERRIDES: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());

/// Turns an experiment on for this process (`pointo reprocess --experiment <name>`).
pub fn enable_experiment(name: &str) {
    EXPERIMENT_OVERRIDES
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .push(name.to_owned());
}

/// Whether an experiment is on: `"experiments": {"<name>": true}` in `config.json`, or
/// `enable_experiment` in this process. Off by default; tests see only `enable_experiment`.
pub fn experiment(name: &str) -> bool {
    let overridden = EXPERIMENT_OVERRIDES
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .iter()
        .any(|n| n == name);
    if overridden || cfg!(test) {
        return overridden;
    }
    config().experiments.get(name).copied().unwrap_or(false)
}

pub fn default_config_path() -> PathBuf {
    std::env::var_os("SCRAWL_CONFIG")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".config/pointo/config.json")
        })
}

pub fn load_config_from(path: &Path) -> Config {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
        .map(config_from_value)
        .unwrap_or_default()
}

/// The config in `value`. A key whose value doesn't fit (`"autoSend": "maybe"`) is dropped and
/// logged on its own, so one bad setting never resets the others to their defaults.
fn config_from_value(value: serde_json::Value) -> Config {
    let serde_json::Value::Object(map) = value else {
        return Config::default();
    };
    if let Ok(config) = serde_json::from_value(serde_json::Value::Object(map.clone())) {
        return config;
    }
    // Add keys one at a time, keeping each only if everything so far still reads.
    let mut kept = serde_json::Map::new();
    for (key, value) in map {
        kept.insert(key.clone(), value.clone());
        if let Err(error) =
            serde_json::from_value::<Config>(serde_json::Value::Object(kept.clone()))
        {
            kept.remove(&key);
            log_config_once(format!("config.json: ignoring \"{key}\": {error}"));
        }
    }
    serde_json::from_value(serde_json::Value::Object(kept)).unwrap_or_default()
}

fn config() -> Config {
    load_config_from(&default_config_path())
}

fn random_bytes_32() -> Result<[u8; 32]> {
    let mut bytes = [0_u8; 32];
    #[cfg(windows)]
    {
        crate::win::shell::random_bytes(&mut bytes)?;
    }
    #[cfg(not(windows))]
    {
        use std::io::Read as _;
        let mut file = fs::File::open("/dev/urandom").context("Could not open /dev/urandom")?;
        file.read_exact(&mut bytes)
            .context("Could not read 32 bytes from /dev/urandom")?;
    }
    Ok(bytes)
}

fn random_hex_token_32() -> Result<String> {
    use std::fmt::Write as _;
    let bytes = random_bytes_32()?;
    let mut token = String::with_capacity(64);
    for byte in bytes {
        let _ = write!(&mut token, "{byte:02x}");
    }
    Ok(token)
}

/// Returns `ingestToken` from `path`, generating a 32-byte hex token and writing `path` back with
/// mode `0600` (while preserving all other JSON keys) if `ingestToken` is absent or empty.
pub fn ensure_ingest_token_in(path: &Path) -> Result<String> {
    let mut map = match fs::read(path) {
        Ok(bytes) if !bytes.iter().all(u8::is_ascii_whitespace) => {
            match serde_json::from_slice::<serde_json::Value>(&bytes)
                .with_context(|| format!("Invalid JSON in {}", path.display()))?
            {
                serde_json::Value::Object(map) => map,
                _ => bail!("Expected a JSON object in {}", path.display()),
            }
        }
        Ok(_) | Err(_) => serde_json::Map::new(),
    };

    if let Some(existing) = map
        .get("ingestToken")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Ok(existing.to_owned());
    }

    let token = random_hex_token_32()?;
    map.insert(
        "ingestToken".to_owned(),
        serde_json::Value::String(token.clone()),
    );
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)
            .with_context(|| format!("Could not create {}", parent.display()))?;
    }
    let mut body = serde_json::to_vec_pretty(&serde_json::Value::Object(map))?;
    body.push(b'\n');
    #[cfg(unix)]
    {
        use std::io::Write as _;
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        let mut file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .with_context(|| format!("Could not write {}", path.display()))?;
        file.write_all(&body)?;
        file.sync_all()?;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(not(unix))]
    {
        fs::write(path, &body).with_context(|| format!("Could not write {}", path.display()))?;
    }
    Ok(token)
}

pub fn ensure_ingest_token() -> Result<String> {
    ensure_ingest_token_in(&default_config_path())
}

/// Whether Mac captures go straight to the project they were of (`autoSend`, default on).
pub fn auto_send() -> bool {
    config().auto_send.unwrap_or(true)
}

/// The folder every capture goes to, when the user pinned one (`project` in config.json, `~`
/// allowed). A path that isn't an existing folder is ignored. Tests see none.
pub fn pinned_project() -> Option<PathBuf> {
    if cfg!(test) {
        return None;
    }
    pinned_project_in(&config())
}

fn pinned_project_in(config: &Config) -> Option<PathBuf> {
    configured_project(config.project.as_deref()?)
}

/// `value` from `project` in config.json as an existing folder: absolute, `~` expanded.
pub fn configured_project(value: &str) -> Option<PathBuf> {
    expand_home(value).filter(|folder| folder.is_dir())
}

/// An absolute folder path from config, `~` expanded.
fn expand_home(path: &str) -> Option<PathBuf> {
    let path = path.trim();
    let expanded = match path.strip_prefix("~/") {
        Some(rest) => dirs::home_dir()?.join(rest),
        None if path == "~" => dirs::home_dir()?,
        None => PathBuf::from(path),
    };
    expanded.is_absolute().then_some(expanded)
}

/// Folders captures were delivered to, most recent first (`recentProjects`), skipping any that no
/// longer exist. Tests see none.
pub fn recent_projects() -> Vec<PathBuf> {
    if cfg!(test) {
        return Vec::new();
    }
    recent_projects_in(&config())
}

fn recent_projects_in(config: &Config) -> Vec<PathBuf> {
    config
        .recent_projects
        .iter()
        .filter_map(|p| expand_home(p))
        .filter(|p| p.is_dir())
        .collect()
}

/// Puts `project` first in `recentProjects` (`project::push_recent`). Tests never write Kit's
/// config.
pub fn remember_project(project: &str) {
    if cfg!(test) {
        return;
    }
    let path = default_config_path();
    let recent = crate::project::push_recent(&load_config_from(&path).recent_projects, project);
    if let Err(err) = set_config_value_in(&path, "recentProjects", serde_json::json!(recent)) {
        crate::capture::scrawl_log(format!("recent projects: {err:#}"));
    }
}

/// Whether the menu offers video export (`videoExport`, default off). `pointo export` works
/// either way.
pub fn video_export() -> bool {
    config().video_export.unwrap_or(false)
}

/// The configured transcriber name (`transcriber`) as written, unvalidated.
pub fn transcriber() -> Option<String> {
    config().transcriber
}

/// The configured spoken language (`language`, or `appleLocale` in older configs), or `None`
/// when the model should tell.
pub fn language() -> Option<String> {
    language_from(&config())
}

pub fn language_from(config: &Config) -> Option<String> {
    config
        .language
        .as_deref()
        .and_then(crate::speech_model::language_id)
}

/// Saves the spoken language (`None` is Automatic) under `language`, dropping `appleLocale` from
/// configs that still have it.
pub fn set_language_in(path: &Path, language: Option<&str>) -> Result<()> {
    const LEGACY_KEY: &str = "appleLocale";
    set_config_value_in(
        path,
        "language",
        language.map_or(serde_json::Value::Null, Into::into),
    )?;
    set_config_value_in(path, LEGACY_KEY, serde_json::Value::Null)
}

/// The command transcriber's program (`transcribeCommand`, `transcribeTimeoutSeconds`), read
/// on its own from the config file.
pub fn transcribe_command()
-> Result<crate::command_transcriber::Program, crate::command_transcriber::Unusable> {
    crate::command_transcriber::Program::load_from(&default_config_path())
}

/// Whether the native AppKit + Metal recording pill is enabled (`SCRAWL_NATIVE_PILL` or
/// `nativePill` in `config.json`, default `true`). macOS only: elsewhere the GPUI capsule draws.
pub fn native_pill() -> bool {
    if cfg!(not(target_os = "macos")) {
        return false;
    }
    if let Ok(val) = std::env::var("SCRAWL_NATIVE_PILL") {
        let s = val.trim().to_ascii_lowercase();
        if matches!(s.as_str(), "0" | "false" | "gpui" | "off" | "no") {
            return false;
        }
        if matches!(s.as_str(), "1" | "true" | "native" | "metal" | "on" | "yes") {
            return true;
        }
    }
    config().native_pill.unwrap_or(true)
}

/// Configured capsule style (`pillStyle` in `config.json`, default `"black"`).
pub fn pill_style() -> crate::native::pill::PillStyle {
    config()
        .pill_style
        .as_deref()
        .and_then(crate::native::pill::PillStyle::from_str_opt)
        .unwrap_or(crate::native::pill::PillStyle::Black)
}

/// Sets one top-level key in `path` (`null` removes it), keeping the rest (and its `0600` mode,
/// since it holds the ingest token).
pub fn set_config_value_in(path: &Path, key: &str, value: serde_json::Value) -> Result<()> {
    let mut config = fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| serde_json::json!({}));
    match (value, config.as_object_mut()) {
        (serde_json::Value::Null, Some(map)) => {
            map.remove(key);
        }
        (value, _) => config[key] = value,
    }
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    let mut body = serde_json::to_vec_pretty(&config)?;
    body.push(b'\n');
    fs::write(&tmp, body)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(&tmp, path).with_context(|| format!("Could not write {}", path.display()))
}

/// Bundle IDs whose `Documents/Pointo` (and legacy `Documents/Tether`) container the USB watcher
/// checks (`usbApps` in config, with `tetherApps` accepted as a fallback alias; default empty so
/// USB polling is off unless configured).
pub fn usb_apps() -> Vec<String> {
    config()
        .usb_apps
        .into_iter()
        .map(|s| s.trim().to_owned())
        .filter(|s| safe_word(s))
        .collect()
}

/// Safe to put unquoted in a remote shell command (host names, `~/bin/tool` paths).
fn safe_word(text: &str) -> bool {
    !text.is_empty()
        && text
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.@/~".contains(&b))
}

/// Bundle files that are big and that agents seldom open: delivery leaves them in the original
/// bundle, and retention shrinks or drops them first.
pub const HEAVY_MEDIA: [&str; 5] = [
    "recording.mp4",
    "recording.mov",
    "audio.wav",
    "frames-full",
    "contact-sheet-full.png",
];

pub(crate) fn query_escape(value: &str) -> String {
    let mut result = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || b"-._~".contains(&byte) {
            result.push(char::from(byte));
        } else {
            result.push_str(&format!("%{byte:02X}"));
        }
    }
    result
}

pub fn extract_frames_range(
    bundle_dir: &Path,
    from_ms: u64,
    to_ms: u64,
    fps: u32,
) -> Result<Vec<PathBuf>> {
    ensure!(from_ms <= to_ms, "Frame range ends before it starts");
    ensure!(fps > 0 && fps <= 240, "FPS must be between 1 and 240");
    let directory = resolve_bundle_dir(bundle_dir)?;
    let loaded = load_bundle(&directory).ok().map(|(_, bundle)| bundle);
    let offset_ms = loaded.as_ref().map_or(0, |b| b.video_offset_ms);
    let video = loaded
        .and_then(|bundle| bundle.video)
        .map_or_else(|| directory.join("recording.mp4"), |v| directory.join(v));
    if video.is_file() && from_ms < to_ms {
        let output_dir = directory
            .join("zoom")
            .join(format!("range-{from_ms}-{to_ms}"));
        if let Some(ffmpeg) = on_path("ffmpeg") {
            fs::create_dir_all(&output_dir)?;
            // Only remove our generated files, so repeating at a lower FPS cannot
            // return leftover frames from a previous extraction.
            for entry in fs::read_dir(&output_dir)? {
                let entry = entry?;
                if generated_frame(&entry.path()) {
                    fs::remove_file(entry.path())?;
                }
            }
            let output = Command::new(ffmpeg)
                .args([
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-nostdin",
                    "-y",
                    "-ss",
                ])
                .arg(format!("{:.3}", from_ms as f64 / 1_000.0))
                .args(["-threads", "1", "-filter_threads", "1"])
                .arg("-i")
                .arg(&video)
                .arg("-t")
                .arg(format!("{:.3}", (to_ms - from_ms) as f64 / 1_000.0))
                .arg("-vf")
                .arg(format!("fps={fps}"))
                .args(["-threads", "1"])
                .arg(output_dir.join("frame-%03d.png"))
                .output()
                .context("Could not start ffmpeg")?;
            ensure!(
                output.status.success(),
                "ffmpeg extraction failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
            let mut frames = Vec::new();
            for entry in fs::read_dir(&output_dir)? {
                let path = entry?.path();
                if generated_frame(&path) {
                    frames.push(path);
                }
            }
            frames.sort();
            return Ok(frames);
        }

        let step_ms = (1_000 / u64::from(fps)).max(1);
        let times: Vec<u64> = (from_ms..=to_ms).step_by(step_ms as usize).collect();
        if !times.is_empty()
            && let Ok(decoded) = crate::movie_frames_at(&video, &times, offset_ms, 0)
            && !decoded.is_empty()
        {
            fs::create_dir_all(&output_dir)?;
            for entry in fs::read_dir(&output_dir)? {
                let entry = entry?;
                if generated_frame(&entry.path()) {
                    fs::remove_file(entry.path())?;
                }
            }
            let mut written = Vec::with_capacity(decoded.len());
            for (idx, frame) in decoded.iter().enumerate() {
                let out_path = output_dir.join(format!("frame-{:03}.png", idx + 1));
                crate::render::save_png(frame, &out_path)?;
                written.push(out_path);
            }
            return Ok(written);
        }
    }
    existing_keyframes(&directory, from_ms, to_ms, fps)
}

fn generated_frame(path: &Path) -> bool {
    path.is_file()
        && path.extension().is_some_and(|ext| ext == "png")
        && path
            .file_stem()
            .and_then(|name| name.to_str())
            .and_then(|name| name.strip_prefix("frame-"))
            .is_some_and(|digits| {
                !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit())
            })
}

fn existing_keyframes(
    directory: &Path,
    from_ms: u64,
    to_ms: u64,
    fps: u32,
) -> Result<Vec<PathBuf>> {
    let (_, bundle) = load_bundle(directory)?;
    let margin = 1_000_u64.div_ceil(u64::from(fps)) / 2;
    let mut frames = Vec::new();
    for frame in bundle.keyframes {
        if frame.t < from_ms.saturating_sub(margin) || frame.t > to_ms.saturating_add(margin) {
            continue;
        }
        let relative = Path::new(&frame.file);
        ensure!(
            !relative.is_absolute()
                && relative.components().all(|part| matches!(
                    part,
                    std::path::Component::Normal(_) | std::path::Component::CurDir
                )),
            "Invalid keyframe path"
        );
        let path = directory.join(relative);
        if generated_frame(&path) {
            let canonical = plain_path(path.canonicalize()?);
            ensure!(
                canonical.starts_with(directory.join("frames")),
                "Keyframe is outside bundle frames directory"
            );
            frames.push((frame.t, canonical));
        }
    }
    frames.sort_unstable();
    frames.dedup_by(|a, b| a.1 == b.1);
    Ok(frames.into_iter().map(|(_, path)| path).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            static COUNTER: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "pointo-handoff-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                COUNTER.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn bundle(&self, name: &str, created: u64) -> PathBuf {
            let path = self.0.join(format!("{name}.pointo"));
            fs::create_dir_all(path.join("frames")).unwrap();
            let keyframes: Vec<_> = [0, 1_900, 2_500, 4_000, 5_100, 6_000].into_iter().enumerate().map(|(index, t)| {
                let file = format!("frames/frame-{index:03}.png");
                fs::write(path.join(&file), b"fixture").unwrap();
                serde_json::json!({"index": index, "t": t, "reason": "initial", "file": file, "event": ""})
            }).collect();
            let bundle = serde_json::json!({
                "version": 1, "id": name, "createdAtMs": created, "durationMs": 7_000,
                "target": {"mode": "display", "displayId": 1,
                    "frame": {"x": 0.0, "y": 0.0, "width": 100.0, "height": 100.0, "scale": 1.0}},
                "transcript": {"source": "none", "text": "", "segments": []},
                "strokes": [], "marks": [], "events": [], "keyframes": keyframes,
                "contactSheet": "contact-sheet.png"
            });
            fs::write(
                path.join("pointo.json"),
                serde_json::to_vec(&bundle).unwrap(),
            )
            .unwrap();
            path
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn resolves_directory_manifest_and_newest_capture() {
        let fixture = Fixture::new();
        let older = fixture.bundle("old", 100);
        let newer = fixture.bundle("new", 200);
        assert_eq!(
            resolve_bundle_dir(&older).unwrap(),
            plain_path(older.canonicalize().unwrap())
        );
        assert_eq!(
            resolve_bundle_dir(&older.join("pointo.json")).unwrap(),
            plain_path(older.canonicalize().unwrap())
        );
        assert_eq!(
            newest_bundle(&fixture.0).unwrap(),
            plain_path(newer.canonicalize().unwrap())
        );
        assert!(resolve_bundle_dir(&fixture.0).is_err());
        assert!(resolve_bundle_dir(&fixture.0.join("missing.pointo")).is_err());
    }

    #[test]
    fn loads_manifest_and_reports_invalid_json() {
        let fixture = Fixture::new();
        let path = fixture.bundle("example", 123);
        let (resolved, bundle) = load_bundle(&path.join("pointo.json")).unwrap();
        assert_eq!(resolved, plain_path(path.canonicalize().unwrap()));
        assert_eq!(bundle.id, "example");
        assert_eq!(bundle.created_at_ms, 123);
        fs::write(path.join("pointo.json"), b"not json").unwrap();
        assert!(load_bundle(&path).is_err());
    }

    #[test]
    fn frame_fallback_uses_manifest_times_not_file_indices() {
        let fixture = Fixture::new();
        let path = fixture.bundle("example", 123);
        let frames = extract_frames_range(&path, 2_000, 5_000, 4).unwrap();
        let names: Vec<_> = frames
            .iter()
            .map(|frame| frame.file_name().unwrap().to_str().unwrap())
            .collect();
        assert_eq!(
            names,
            vec![
                "frame-001.png",
                "frame-002.png",
                "frame-003.png",
                "frame-004.png"
            ]
        );
        assert!(
            extract_frames_range(&path, 10_000, 11_000, 4)
                .unwrap()
                .is_empty()
        );
        assert!(extract_frames_range(&path, 5_000, 2_000, 4).is_err());
        assert!(extract_frames_range(&path, 0, 2_000, 0).is_err());
    }

    #[test]
    fn token_generation_persists_with_0600_and_preserves_other_keys() {
        let fixture = Fixture::new();
        let config_path = fixture.0.join("nested/config.json");
        fs::create_dir_all(config_path.parent().unwrap()).unwrap();
        fs::write(
            &config_path,
            br#"{"project":"/p/app","usbApps":["com.kitlangton.UpDown"],"customKey":42}"#,
        )
        .unwrap();

        let generated = ensure_ingest_token_in(&config_path).unwrap();
        assert_eq!(generated.len(), 64);
        assert!(generated.bytes().all(|b| b.is_ascii_hexdigit()));

        // Calling a second time returns the same token without regenerating.
        let second = ensure_ingest_token_in(&config_path).unwrap();
        assert_eq!(generated, second);

        // Other keys are preserved and parsed properly.
        let parsed = load_config_from(&config_path);
        assert_eq!(parsed.project.as_deref(), Some("/p/app"));
        assert_eq!(parsed.ingest_token.as_deref(), Some(generated.as_str()));
        assert_eq!(parsed.usb_apps, vec!["com.kitlangton.UpDown"]);

        let legacy_path = fixture.0.join("nested/legacy.json");
        fs::write(&legacy_path, br#"{"tetherApps":["com.kitlangton.UpDown"]}"#).unwrap();
        assert_eq!(
            load_config_from(&legacy_path).usb_apps,
            vec!["com.kitlangton.UpDown"]
        );

        let raw: serde_json::Value =
            serde_json::from_slice(&fs::read(&config_path).unwrap()).unwrap();
        assert_eq!(raw["customKey"], serde_json::json!(42));

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&config_path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
    }

    #[test]
    fn language_round_trips_and_keeps_other_keys() {
        let fixture = Fixture::new();
        let path = fixture.0.join("config.json");
        fs::write(&path, br#"{"ingestToken":"abc","autoSend":false}"#).unwrap();
        let config = load_config_from(&path);
        assert_eq!(language_from(&config), None);
        assert_eq!(config.auto_send, Some(false));

        for (value, expected) in [
            (Some("zh-CN"), Some("zh-CN")),
            (Some("bad value"), None),
            (None, None),
        ] {
            set_language_in(&path, value).unwrap();
            let config = load_config_from(&path);
            assert_eq!(language_from(&config).as_deref(), expected);
            assert_eq!(config.ingest_token.as_deref(), Some("abc"));
            assert_eq!(config.auto_send, Some(false));
        }
        let raw: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert!(raw.get("language").is_none());
    }

    #[test]
    fn an_old_apple_locale_is_the_language_until_one_is_saved() {
        let fixture = Fixture::new();
        let path = fixture.0.join("config.json");
        fs::write(&path, br#"{"appleLocale":"yue","autoSend":false}"#).unwrap();
        assert_eq!(language_from(&load_config_from(&path)).as_deref(), Some("yue"));
        set_language_in(&path, Some("en-US")).unwrap();
        let raw: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(raw["language"], "en-US");
        assert!(raw.get("appleLocale").is_none());
        assert_eq!(language_from(&load_config_from(&path)).as_deref(), Some("en-US"));
        // Both keys present (hand-edited): the config still loads and keeps its other keys.
        fs::write(&path, br#"{"appleLocale":"yue","language":"zh-CN","autoSend":false}"#).unwrap();
        let config = load_config_from(&path);
        assert_eq!(config.auto_send, Some(false));
        assert!(language_from(&config).is_some());
    }

    #[test]
    fn transcriber_preference_round_trips_and_keeps_other_keys() {
        let fixture = Fixture::new();
        let path = fixture.0.join("config.json");
        fs::write(&path, br#"{"ingestToken":"abc","autoSend":false}"#).unwrap();
        let config = load_config_from(&path);
        assert_eq!(config.transcriber, None);
        set_config_value_in(&path, "transcriber", "command".into()).unwrap();
        let config = load_config_from(&path);
        assert_eq!(config.transcriber.as_deref(), Some("command"));
        assert_eq!(config.ingest_token.as_deref(), Some("abc"));
        assert_eq!(config.auto_send, Some(false));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
    }

    #[test]
    fn malformed_command_keys_never_reset_the_rest_of_the_config() {
        let fixture = Fixture::new();
        let path = fixture.0.join("config.json");
        fs::write(
            &path,
            br#"{"transcriber":"command","autoSend":false,"transcribeCommand":"whisper {audio}","transcribeTimeoutSeconds":"soon"}"#,
        )
        .unwrap();
        let config = load_config_from(&path);
        assert_eq!(config.transcriber.as_deref(), Some("command"));
        assert_eq!(config.auto_send, Some(false));
    }

    #[test]
    fn auto_send_defaults_on_and_the_toggle_keeps_other_keys() {
        let fixture = Fixture::new();
        let path = fixture.0.join("config.json");
        fs::write(
            &path,
            br#"{"ingestToken":"abc","retention":{"mediaDays":7}}"#,
        )
        .unwrap();
        assert_eq!(load_config_from(&path).auto_send, None);
        set_config_value_in(&path, "autoSend", serde_json::Value::Bool(false)).unwrap();
        let config = load_config_from(&path);
        assert_eq!(config.auto_send, Some(false));
        assert_eq!(config.ingest_token.as_deref(), Some("abc"));
        let raw: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(raw["retention"]["mediaDays"], 7);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
    }

    #[test]
    fn video_export_flag_defaults_off() {
        let fixture = Fixture::new();
        let path = fixture.0.join("config.json");
        fs::write(&path, br#"{"autoSend":false}"#).unwrap();
        assert_eq!(load_config_from(&path).video_export, None);
        fs::write(&path, br#"{"videoExport":true}"#).unwrap();
        assert_eq!(load_config_from(&path).video_export, Some(true));
    }

    #[test]
    fn config_defaults_when_missing_or_minimal() {
        let fixture = Fixture::new();
        let missing = fixture.0.join("missing.json");
        let cfg = load_config_from(&missing);
        assert_eq!(cfg, Config::default());
        assert!(cfg.usb_apps.is_empty());

        let token = ensure_ingest_token_in(&missing).unwrap();
        assert_eq!(token.len(), 64);
        let cfg_after = load_config_from(&missing);
        assert_eq!(cfg_after.ingest_token.as_deref(), Some(token.as_str()));
        assert!(cfg_after.usb_apps.is_empty());
    }

    #[test]
    fn an_unusable_captures_folder_is_refused() {
        let root = std::env::temp_dir().join(format!("pointo-usable-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let file = root.join("file");
        fs::write(&file, "x").unwrap();
        assert!(!usable_captures_dir(&file.join("inside")));
        assert!(usable_captures_dir(&root.join("new folder")));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn captures_dir_takes_absolute_and_home_paths_only() {
        let home = dirs::home_dir().unwrap();
        assert_eq!(configured_captures_dir("~"), Some(home.clone()));
        assert_eq!(
            configured_captures_dir(" ~/Pointo Captures "),
            Some(home.join("Pointo Captures"))
        );
        let absolute = std::env::temp_dir().join("captures");
        assert_eq!(
            configured_captures_dir(&absolute.display().to_string()),
            Some(absolute)
        );
        assert_eq!(configured_captures_dir("captures"), None);
        assert_eq!(configured_captures_dir("~someone/captures"), None);
        assert_eq!(configured_captures_dir("  "), None);
    }

    #[test]
    fn one_bad_setting_never_resets_the_others() {
        let fixture = Fixture::new();
        let path = fixture.0.join("config.json");
        fs::write(
            &path,
            r#"{"project": "/p/app", "recentProjects": ["/p/app"], "autoSend": "maybe", "usbApps": "not-a-list", "videoExport": true, "nativePill": 3, "pillStyle": "glass", "unknown": {"x": 1}}"#,
        )
        .unwrap();
        let cfg = load_config_from(&path);
        assert_eq!(cfg.project.as_deref(), Some("/p/app"));
        assert_eq!(cfg.recent_projects, ["/p/app"]);
        assert_eq!(cfg.video_export, Some(true));
        assert_eq!(cfg.pill_style.as_deref(), Some("glass"));
        assert_eq!(cfg.auto_send, None);
        assert_eq!(cfg.native_pill, None);
        assert!(cfg.usb_apps.is_empty());
        // Both spellings of one field: one is kept rather than neither.
        fs::write(
            &path,
            r#"{"usbApps": ["a"], "tetherApps": ["b"], "project": "/p/pro"}"#,
        )
        .unwrap();
        let cfg = load_config_from(&path);
        assert_eq!(cfg.project.as_deref(), Some("/p/pro"));
        assert_eq!(cfg.usb_apps.len(), 1);
    }

    #[test]
    fn experiments_are_read_from_config_and_off_by_default() {
        let fixture = Fixture::new();
        let path = fixture.0.join("config.json");
        fs::write(
            &path,
            r#"{"experiments": {"agentContext": true, "other": false}}"#,
        )
        .unwrap();
        let cfg = load_config_from(&path);
        assert_eq!(cfg.experiments.get(AGENT_CONTEXT), Some(&true));
        assert_eq!(cfg.experiments.get("other"), Some(&false));
        assert!(Config::default().experiments.is_empty());
        // A bad value skips that experiment, never the file.
        fs::write(
            &path,
            r#"{"autoSend": false, "experiments": {"agentContext": "yes", "a": 1, "b": "maybe", "c": [1], "d": "off"}}"#,
        )
        .unwrap();
        let cfg = load_config_from(&path);
        assert_eq!(cfg.auto_send, Some(false));
        assert_eq!(cfg.experiments.get(AGENT_CONTEXT), Some(&true));
        assert_eq!(cfg.experiments.get("a"), Some(&true));
        assert_eq!(cfg.experiments.get("d"), Some(&false));
        assert!(!cfg.experiments.contains_key("b") && !cfg.experiments.contains_key("c"));
        fs::write(&path, r#"{"autoSend": false, "experiments": true}"#).unwrap();
        let cfg = load_config_from(&path);
        assert_eq!(cfg.auto_send, Some(false));
        assert!(cfg.experiments.is_empty());
        // Tests never read Kit's config, only what this process turned on.
        assert!(!experiment("neverEnabled"));
        enable_experiment("enabledForThisTest");
        assert!(experiment("enabledForThisTest"));
    }
}
