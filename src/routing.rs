//! Which project folder a Mac capture is delivered to (`project::deliver`). The ladder, first
//! hit wins:
//!
//! 1. **Pinned**: `"project"` in config.json, the folder the user chose in Settings.
//! 2. **Page**: the browser tab registered itself through Pointo's `/sdk.js` (`web`) with a
//!    `data-directory`.
//! 3. **Port**: the tab is on a loopback host or one of this Mac's own names: the process
//!    listening on that port, its working directory, that directory's git root.
//! 4. **Terminal**: the captured or frontmost terminal's focused folder, up to its git root.
//! 5. Nothing: the capture stays on the clipboard.
//!
//! The home folder and `/` never count (`is_home_or_root`). `"autoSend": false` turns the whole
//! ladder off; a folder picked on the pill's chip still delivers.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use crate::capture::scrawl_log;
use crate::model::Destination;
use crate::web::Registration;

/// The parts of an `http(s)` URL routing needs.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WebUrl {
    pub scheme: String,
    pub host: String,
    pub port: u16,
}

impl WebUrl {
    /// `scheme://host[:port]`, the port left out when it's the scheme's default (as browsers send
    /// `Origin`).
    pub fn origin(&self) -> String {
        let default = if self.scheme == "https" { 443 } else { 80 };
        let host = if self.host.contains(':') {
            format!("[{}]", self.host)
        } else {
            self.host.clone()
        };
        if self.port == default {
            format!("{}://{host}", self.scheme)
        } else {
            format!("{}://{host}:{}", self.scheme, self.port)
        }
    }

    pub fn is_loopback(&self) -> bool {
        is_loopback_host(&self.host)
    }
}

/// Parses `http://` and `https://` URLs (and bare origins). Hosts are lowercased; IPv6 hosts
/// lose their brackets.
pub fn parse_url(url: &str) -> Option<WebUrl> {
    let url = url.trim();
    let (scheme, rest) = url.split_once("://")?;
    let scheme = scheme.to_ascii_lowercase();
    if scheme != "http" && scheme != "https" {
        return None;
    }
    let authority = rest.split(['/', '?', '#']).next()?;
    let authority = authority
        .rsplit_once('@')
        .map_or(authority, |(_, host)| host);
    let (host, port) = if let Some(v6) = authority.strip_prefix('[') {
        let (host, after) = v6.split_once(']')?;
        let port = match after.strip_prefix(':') {
            Some(port) => Some(port.parse().ok()?),
            None if after.is_empty() => None,
            None => return None,
        };
        (host.to_owned(), port)
    } else {
        match authority.rsplit_once(':') {
            Some((host, port)) => (host.to_owned(), Some(port.parse().ok()?)),
            None => (authority.to_owned(), None),
        }
    };
    if host.is_empty()
        || !host
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".-_:".contains(&b))
    {
        return None;
    }
    let port = port.unwrap_or(if scheme == "https" { 443 } else { 80 });
    Some(WebUrl {
        scheme,
        host: host.to_ascii_lowercase(),
        port,
    })
}

/// `localhost`, `*.localhost`, `127.0.0.0/8`, `::1`, and `0.0.0.0` (which browsers send to this
/// machine).
pub fn is_loopback_host(host: &str) -> bool {
    let host = host
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_ascii_lowercase();
    if host == "localhost" || host.ends_with(".localhost") || host == "::1" || host == "0.0.0.0" {
        return true;
    }
    host.parse::<std::net::Ipv4Addr>()
        .is_ok_and(|ip| ip.is_loopback())
}

// MARK: The browser tab

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Browser {
    /// Chrome, Brave, Arc, Edge, Vivaldi, Chromium: `URL of active tab of front window`.
    Chromium,
    /// Safari: `URL of current tab of front window`.
    Safari,
}

pub fn browser_kind(bundle_id: &str) -> Option<Browser> {
    const CHROMIUM: [&str; 6] = [
        "com.google.chrome",
        "com.brave.browser",
        "company.thebrowser.browser",
        "com.microsoft.edgemac",
        "com.vivaldi.vivaldi",
        "org.chromium.chromium",
    ];
    let id = bundle_id.to_ascii_lowercase();
    if id == "com.apple.safari" || id == "com.apple.safaritechnologypreview" {
        return Some(Browser::Safari);
    }
    // Beta, dev, nightly, and canary channels add a suffix.
    CHROMIUM
        .iter()
        .any(|base| id == *base || id.strip_prefix(base).is_some_and(|s| s.starts_with('.')))
        .then_some(Browser::Chromium)
}

fn safe_bundle_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".-_".contains(&b))
}

/// The front tab's URL in the browser `bundle_id`, through AppleScript. The first time macOS
/// asks whether Pointo may control the browser; while that prompt is up this waits a few
/// seconds, then gives up for this capture. A denial just returns `None`.
pub fn browser_tab_url(bundle_id: &str) -> Option<String> {
    let kind = browser_kind(bundle_id)?;
    if !safe_bundle_id(bundle_id) {
        return None;
    }
    let tab = match kind {
        Browser::Chromium => "active tab",
        Browser::Safari => "current tab",
    };
    let script = format!(
        "tell application id \"{bundle_id}\"\nif (count of windows) is 0 then return \"\"\nreturn URL of {tab} of front window\nend tell"
    );
    let output = run_with_timeout(
        Command::new("/usr/bin/osascript").args(["-e", &script]),
        Duration::from_secs(6),
    )?;
    if !output.status.success() {
        scrawl_log(format!(
            "routing: couldn't read the {bundle_id} tab ({})",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
        return None;
    }
    let url = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    (!url.is_empty()).then_some(url)
}

fn run_with_timeout(command: &mut Command, timeout: Duration) -> Option<std::process::Output> {
    use std::io::Read as _;
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    // Read as it's written: output larger than a pipe's buffer would otherwise stall the child.
    let drain = |pipe: Option<Box<dyn std::io::Read + Send>>| {
        std::thread::spawn(move || {
            let mut out = Vec::new();
            if let Some(mut pipe) = pipe {
                let _ = pipe.read_to_end(&mut out);
            }
            out
        })
    };
    let stdout = drain(child.stdout.take().map(|p| Box::new(p) as _));
    let stderr = drain(child.stderr.take().map(|p| Box::new(p) as _));
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return Some(std::process::Output {
                    status,
                    stdout: stdout.join().ok()?,
                    stderr: stderr.join().ok()?,
                });
            }
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(20)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                scrawl_log("routing: gave up waiting on a subprocess");
                return None;
            }
        }
    }
}

/// The URL a capture was of: the browser in front when it finished, else the captured window's
/// browser.
pub fn capture_url(
    front_bundle_id: Option<&str>,
    target_bundle_id: Option<&str>,
) -> Option<String> {
    [front_bundle_id, target_bundle_id]
        .into_iter()
        .flatten()
        .filter(|id| browser_kind(id).is_some())
        .find_map(browser_tab_url)
}

// MARK: Port → folder

/// PIDs in `lsof -F p` output (`p1234` lines), in order, without repeats.
pub fn parse_lsof_pids(output: &str) -> Vec<i32> {
    let mut pids = Vec::new();
    for pid in output
        .lines()
        .filter_map(|line| line.strip_prefix('p')?.trim().parse::<i32>().ok())
    {
        if pid > 0 && !pids.contains(&pid) {
            pids.push(pid);
        }
    }
    pids
}

/// The directory in `lsof -a -p PID -d cwd -Fn` output (the `n` line).
pub fn parse_lsof_cwd(output: &str) -> Option<PathBuf> {
    output
        .lines()
        .find_map(|line| line.strip_prefix('n'))
        .map(str::trim)
        .filter(|path| path.starts_with('/'))
        .map(PathBuf::from)
}

fn lsof(args: &[&str]) -> Option<String> {
    let output = run_with_timeout(
        Command::new("/usr/sbin/lsof").args(args),
        Duration::from_secs(3),
    )?;
    // lsof exits 1 when some of what it was asked about wasn't found.
    let text = String::from_utf8_lossy(&output.stdout).into_owned();
    (!text.trim().is_empty()).then_some(text)
}

/// The working directory of the process listening on TCP `port` on this Mac.
pub fn listener_directory(port: u16) -> Option<PathBuf> {
    let pids = parse_lsof_pids(&lsof(&[
        "-nP",
        &format!("-iTCP:{port}"),
        "-sTCP:LISTEN",
        "-Fp",
    ])?);
    pids.into_iter().find_map(|pid| {
        parse_lsof_cwd(&lsof(&["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"])?)
            .filter(|dir| dir != Path::new("/"))
    })
}

/// The project a directory belongs to: its git root (a `.git` directory or worktree file), or
/// the directory itself with `false` when it isn't in a repository.
pub fn project_root(dir: &Path) -> (PathBuf, bool) {
    let mut current = Some(dir);
    while let Some(path) = current {
        if path.join(".git").exists() {
            return (path.to_path_buf(), true);
        }
        current = path.parent();
    }
    (dir.to_path_buf(), false)
}

/// The fewest facts the ladder reads; the outside steps are swappable in tests.
#[derive(Clone, Copy)]
pub struct Hooks {
    pub pinned: fn() -> Option<PathBuf>,
    pub sdk: fn(&str) -> Option<Registration>,
    /// The port on this Mac that serves a URL's origin, when its host is this Mac.
    pub own_port: fn(&WebUrl) -> Option<u16>,
    pub listener_dir: fn(u16) -> Option<PathBuf>,
    /// The folder and title of a terminal app's focused pane.
    pub terminal: fn(&str) -> Option<(PathBuf, String)>,
}

impl Default for Hooks {
    fn default() -> Self {
        Self {
            pinned: crate::handoff::pinned_project,
            sdk: crate::web::lookup,
            own_port,
            listener_dir: listener_directory,
            terminal: terminal_pane,
        }
    }
}

/// The home folder and `/`: a server or shell started there says nothing about a project.
pub(crate) fn is_home_or_root(path: &Path) -> bool {
    path == Path::new("/") || dirs::home_dir().is_some_and(|home| path == home)
}

/// `dir`'s project root unless that is the home folder or `/`.
fn project_of(dir: &Path) -> Option<PathBuf> {
    let root = project_root(dir).0;
    (!is_home_or_root(&root)).then_some(root)
}

/// [`decide`] unless `auto_send` is off (`"autoSend": false`): then nothing is delivered
/// automatically, a pinned project included.
pub fn decide_auto(
    auto_send: bool,
    url: Option<&str>,
    terminals: &[&str],
    hooks: &Hooks,
) -> std::result::Result<Destination, String> {
    if !auto_send {
        return Err("autoSend is off".to_owned());
    }
    decide(url, terminals, hooks)
}

/// Where a capture goes, or why it goes nowhere: `url` is the browser tab it was of and
/// `terminals` the bundle IDs of the apps in front or captured, searched for a focused pane.
pub fn decide(
    url: Option<&str>,
    terminals: &[&str],
    hooks: &Hooks,
) -> std::result::Result<Destination, String> {
    let destination = |project: &Path, via: &str| Destination {
        project: project.display().to_string(),
        via: via.to_owned(),
        url: url.map(str::to_owned),
    };
    if let Some(project) = (hooks.pinned)().filter(|p| !is_home_or_root(p)) {
        return Ok(destination(&project, "pinned"));
    }
    let mut why = Vec::new();
    if let Some(url) = url {
        if let Some(dir) = (hooks.sdk)(url)
            .and_then(|reg| reg.directory)
            .map(PathBuf::from)
            .filter(|dir| dir.is_dir() && !is_home_or_root(dir))
        {
            return Ok(destination(&dir, "page"));
        }
        match parse_url(url) {
            None => why.push(format!("{url} isn't an http(s) URL")),
            Some(parsed) => match (hooks.own_port)(&parsed) {
                None => why.push(format!("{} isn't served from this Mac", parsed.origin())),
                Some(port) => match (hooks.listener_dir)(port) {
                    None => why.push(format!("no process found listening on port {port}")),
                    Some(dir) => match project_of(&dir) {
                        Some(root) => return Ok(destination(&root, "port")),
                        None => why.push(format!(
                            "the server on port {port} runs in {}, not a project",
                            dir.display()
                        )),
                    },
                },
            },
        }
    }
    if let Some((dir, _)) = terminals.iter().find_map(|id| (hooks.terminal)(id)) {
        match project_of(&dir) {
            Some(root) => return Ok(destination(&root, "terminal")),
            None => why.push(format!(
                "the terminal is in {}, not a project",
                dir.display()
            )),
        }
    }
    Err(if why.is_empty() {
        "no browser tab or terminal to read a project from".to_owned()
    } else {
        why.join("; ")
    })
}

/// Decides where a capture that just finished goes; `None` (logged) keeps it on the clipboard.
/// Reads the tab in front (or captured) and the terminal's pane, so it runs while the bundle is
/// built.
pub fn route_capture(
    front_bundle_id: Option<&str>,
    target_bundle_id: Option<&str>,
) -> Option<Destination> {
    if !crate::handoff::auto_send() {
        scrawl_log("routing: autoSend is off; the capture stays on the clipboard");
        return None;
    }
    let url = capture_url(front_bundle_id, target_bundle_id);
    let terminals: Vec<&str> = [front_bundle_id, target_bundle_id]
        .into_iter()
        .flatten()
        .collect();
    match decide_auto(true, url.as_deref(), &terminals, &Hooks::default()) {
        Ok(dest) => {
            scrawl_log(format!(
                "routing: {} → {} via {}",
                url.as_deref().unwrap_or("capture"),
                dest.project,
                dest.via
            ));
            Some(dest)
        }
        Err(reason) => {
            scrawl_log(format!("routing: stays on the clipboard: {reason}"));
            None
        }
    }
}

/// The folder `pointo send` delivers `bundle_dir` to: the one given, else the one the capture
/// was recorded for, else what the ladder finds from the page the capture recorded (the pinned
/// project at least).
pub fn project_for_send(bundle_dir: &Path, explicit: Option<PathBuf>) -> anyhow::Result<PathBuf> {
    project_for_send_with(bundle_dir, explicit, &Hooks::default())
}

fn project_for_send_with(
    bundle_dir: &Path,
    explicit: Option<PathBuf>,
    hooks: &Hooks,
) -> anyhow::Result<PathBuf> {
    if let Some(folder) = explicit {
        return folder
            .canonicalize()
            .map_err(|err| anyhow::anyhow!("{}: {err}", folder.display()));
    }
    let (_, bundle) = crate::handoff::load_bundle(bundle_dir)?;
    let recorded = bundle.destination.filter(Destination::is_project);
    if let Some(dest) = recorded.as_ref().filter(|d| Path::new(&d.project).is_dir()) {
        return Ok(PathBuf::from(&dest.project));
    }
    let url = recorded.and_then(|d| d.url);
    decide(url.as_deref(), &[], hooks)
        .map(|dest| PathBuf::from(dest.project))
        .map_err(|reason| {
            anyhow::anyhow!("No project to deliver to ({reason}); pass --project <dir>")
        })
}

/// Writes `dest` into the bundle's `pointo.json` and `summary.md`.
pub fn record_destination(
    dir: &Path,
    bundle: &mut crate::model::ScrawlBundle,
    dest: Destination,
) -> anyhow::Result<()> {
    bundle.destination = Some(dest);
    std::fs::write(dir.join("pointo.json"), serde_json::to_vec_pretty(bundle)?)?;
    std::fs::write(
        dir.join("summary.md"),
        crate::sketch::summary_markdown(bundle, dir),
    )?;
    Ok(())
}

// MARK: This Mac's own names

/// The port on this Mac serving `url`: its own port on a loopback host, else, when the host is
/// one of this Mac's names, the loopback port `tailscale serve` proxies it to, or the same
/// port for plain `http`.
pub fn own_port(url: &WebUrl) -> Option<u16> {
    if url.is_loopback() {
        return Some(url.port);
    }
    if !own_names().contains(&url.host) {
        return None;
    }
    tailscale(&["serve", "status", "--json"])
        .and_then(|json| serve_target(&json, &url.host, url.port))
        .or_else(|| (url.scheme == "http").then_some(url.port))
}

/// The loopback port `tailscale serve status --json` proxies `host:port`'s root to.
pub fn serve_target(status: &serde_json::Value, host: &str, port: u16) -> Option<u16> {
    let handlers = status
        .get("Web")?
        .as_object()?
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(&format!("{host}:{port}")))?
        .1
        .get("Handlers")?
        .as_object()?;
    let proxy = handlers
        .get("/")
        .or_else(|| handlers.values().next())?
        .get("Proxy")?
        .as_str()?;
    let target = parse_url(proxy).or_else(|| parse_url(&format!("http://{proxy}")))?;
    target.is_loopback().then_some(target.port)
}

/// This Mac's host names, lowercased: `hostname`, its Bonjour name, and its Tailscale name.
fn own_names() -> &'static [String] {
    static NAMES: OnceLock<Vec<String>> = OnceLock::new();
    NAMES.get_or_init(|| {
        let mut names = Vec::new();
        let mut push = |name: &str| {
            let name = name.trim().trim_end_matches('.').to_ascii_lowercase();
            if !name.is_empty() && !names.contains(&name) {
                names.push(name);
            }
        };
        if let Some(out) = run(&mut Command::new("/bin/hostname")) {
            push(&out);
        }
        if let Some(out) = run(Command::new("/usr/sbin/scutil").args(["--get", "LocalHostName"])) {
            push(&format!("{}.local", out.trim()));
        }
        if let Some(status) = tailscale(&["status", "--json"])
            && let Some(dns) = status.pointer("/Self/DNSName").and_then(|v| v.as_str())
        {
            push(dns);
        }
        names
    })
}

fn run(command: &mut Command) -> Option<String> {
    let output = run_with_timeout(command, Duration::from_secs(2))?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

fn tailscale(args: &[&str]) -> Option<serde_json::Value> {
    const APP: &str = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";
    let binary = if Path::new(APP).exists() {
        APP
    } else {
        "tailscale"
    };
    serde_json::from_str(&run(Command::new(binary).args(args))?).ok()
}

// MARK: Terminals

const GHOSTTY: &str = "com.mitchellh.ghostty";

/// Ghostty's focused pane: its working directory and title (AppleScript, Ghostty 1.3+). Other
/// terminals give nothing yet.
pub fn terminal_pane(bundle_id: &str) -> Option<(PathBuf, String)> {
    if !bundle_id.eq_ignore_ascii_case(GHOSTTY) {
        return None;
    }
    let script = format!(
        "tell application id \"{GHOSTTY}\"\nif (count of windows) is 0 then return \"\"\nset t to focused terminal of selected tab of front window\nreturn (working directory of t) & linefeed & (name of t)\nend tell"
    );
    let output = run(Command::new("/usr/bin/osascript").args(["-e", &script]))?;
    let (dir, title) = output
        .trim_end()
        .split_once('\n')
        .unwrap_or((output.trim(), ""));
    let dir = PathBuf::from(dir.trim());
    (dir.is_absolute() && dir != Path::new("/")).then(|| (dir, title.trim().to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urls_parse_to_origins() {
        let u = parse_url("http://localhost:5173/a/b?c#d").unwrap();
        assert_eq!((u.host.as_str(), u.port), ("localhost", 5173));
        assert_eq!(u.origin(), "http://localhost:5173");
        assert!(u.is_loopback());
        assert_eq!(
            parse_url("HTTPS://User:pw@App.Example.com/x")
                .unwrap()
                .origin(),
            "https://app.example.com"
        );
        assert_eq!(parse_url("http://example.com").unwrap().port, 80);
        let v6 = parse_url("http://[::1]:3000/").unwrap();
        assert_eq!((v6.host.as_str(), v6.port), ("::1", 3000));
        assert_eq!(v6.origin(), "http://[::1]:3000");
        assert!(v6.is_loopback());
        assert!(parse_url("http://127.0.0.1:8080").unwrap().is_loopback());
        assert!(
            parse_url("http://my-app.localhost:1355/")
                .unwrap()
                .is_loopback()
        );
        assert!(
            !parse_url("http://studio.example.ts.net:5173/")
                .unwrap()
                .is_loopback()
        );
        assert!(
            !parse_url("http://localhost.evil.com/")
                .unwrap()
                .is_loopback()
        );
        assert!(parse_url("file:///tmp/x.html").is_none());
        assert!(parse_url("chrome://newtab").is_none());
        assert!(parse_url("http://localhost:notaport/").is_none());
        assert!(parse_url("http:///nohost").is_none());
    }

    #[test]
    fn browsers_are_recognized_by_bundle_id() {
        assert_eq!(browser_kind("com.brave.Browser"), Some(Browser::Chromium));
        assert_eq!(
            browser_kind("com.brave.Browser.beta"),
            Some(Browser::Chromium)
        );
        assert_eq!(
            browser_kind("com.google.Chrome.canary"),
            Some(Browser::Chromium)
        );
        assert_eq!(
            browser_kind("company.thebrowser.Browser"),
            Some(Browser::Chromium)
        );
        assert_eq!(browser_kind("com.apple.Safari"), Some(Browser::Safari));
        assert_eq!(browser_kind("com.mitchellh.ghostty"), None);
        assert_eq!(browser_kind("com.google.Chromecast"), None);
    }

    #[test]
    fn lsof_output_parses() {
        let listen = "p48211\ncnode\np48211\np50002\n";
        assert_eq!(parse_lsof_pids(listen), vec![48211, 50002]);
        assert!(parse_lsof_pids("").is_empty());
        let cwd = "p48211\nfcwd\nn/path/to/pointo/site\n";
        assert_eq!(
            parse_lsof_cwd(cwd),
            Some(PathBuf::from("/path/to/pointo/site"))
        );
        assert_eq!(parse_lsof_cwd("p1\nfcwd\n"), None);
    }

    #[test]
    fn project_root_walks_up_to_git() {
        let base = std::env::temp_dir().join(format!("pointo-root-{}", crate::make_bundle_id()));
        let site = base.join("repo/site/src");
        std::fs::create_dir_all(&site).unwrap();
        std::fs::create_dir_all(base.join("repo/.git")).unwrap();
        assert_eq!(project_root(&site), (base.join("repo"), true));
        let loose = base.join("loose");
        std::fs::create_dir_all(&loose).unwrap();
        // The temp folder isn't in a repository.
        assert_eq!(project_root(&loose), (loose.clone(), false));
        std::fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn tailscale_serve_maps_this_macs_name_to_a_loopback_port() {
        let status = serde_json::json!({
            "TCP": {"4948": {"HTTPS": true}},
            "Web": {
                "studio.example.ts.net:4948": {"Handlers": {"/": {"Proxy": "http://127.0.0.1:4948"}}},
                "studio.example.ts.net:8443": {"Handlers": {"/": {"Proxy": "http://127.0.0.1:3000"}}},
                "studio.example.ts.net:9000": {"Handlers": {"/": {"Proxy": "https://example.com"}}}
            }
        });
        assert_eq!(
            serve_target(&status, "studio.example.ts.net", 4948),
            Some(4948)
        );
        assert_eq!(
            serve_target(&status, "studio.example.ts.net", 8443),
            Some(3000)
        );
        assert_eq!(serve_target(&status, "studio.example.ts.net", 9000), None);
        assert_eq!(serve_target(&status, "studio.example.ts.net", 1), None);
        assert_eq!(serve_target(&serde_json::json!({}), "x", 1), None);
    }

    // The ladder, with the outside steps faked. The folders are real so `is_dir` and `.git`
    // checks run for real; they live in the temp folder for the test run.
    fn base() -> &'static PathBuf {
        static BASE: OnceLock<PathBuf> = OnceLock::new();
        BASE.get_or_init(|| {
            let base = std::env::temp_dir()
                .canonicalize()
                .unwrap()
                .join(format!("pointo-ladder-{}", crate::make_bundle_id()));
            for repo in ["pinned", "page", "port", "terminal"] {
                std::fs::create_dir_all(base.join(repo).join(".git")).unwrap();
                std::fs::create_dir_all(base.join(repo).join("src")).unwrap();
            }
            base
        })
    }

    fn pinned() -> Option<PathBuf> {
        Some(base().join("pinned"))
    }
    fn no_pin() -> Option<PathBuf> {
        None
    }
    fn page(_: &str) -> Option<Registration> {
        Some(Registration {
            directory: Some(base().join("page").display().to_string()),
            ..Registration::default()
        })
    }
    fn no_page(_: &str) -> Option<Registration> {
        None
    }
    fn this_mac(url: &WebUrl) -> Option<u16> {
        url.is_loopback().then_some(url.port)
    }
    fn listener(port: u16) -> Option<PathBuf> {
        (port == 5173).then(|| base().join("port/src"))
    }
    fn home_listener(_: u16) -> Option<PathBuf> {
        dirs::home_dir()
    }
    fn terminal(id: &str) -> Option<(PathBuf, String)> {
        (id == GHOSTTY).then(|| (base().join("terminal/src"), "zsh".into()))
    }
    fn home_terminal(_: &str) -> Option<(PathBuf, String)> {
        Some((PathBuf::from("/"), "zsh".into()))
    }
    fn nothing(_: &str) -> Option<(PathBuf, String)> {
        None
    }

    fn hooks() -> Hooks {
        Hooks {
            pinned: no_pin,
            sdk: no_page,
            own_port: this_mac,
            listener_dir: listener,
            terminal,
        }
    }

    const TAB: &str = "http://localhost:5173/a";

    #[test]
    fn the_ladder_prefers_pinned_then_page_then_port_then_terminal() {
        let pick = |hooks: &Hooks, url: Option<&str>| {
            decide(url, &[GHOSTTY], hooks).map(|d| {
                (
                    Path::new(&d.project)
                        .strip_prefix(base())
                        .unwrap()
                        .display()
                        .to_string(),
                    d.via,
                )
            })
        };
        let all = Hooks {
            pinned,
            sdk: page,
            ..hooks()
        };
        assert_eq!(
            pick(&all, Some(TAB)),
            Ok(("pinned".into(), "pinned".into()))
        );
        let no_pin = Hooks {
            pinned: no_pin,
            ..all
        };
        assert_eq!(pick(&no_pin, Some(TAB)), Ok(("page".into(), "page".into())));
        let no_page = Hooks {
            sdk: no_page,
            ..no_pin
        };
        // A subfolder's server resolves to its git root.
        assert_eq!(
            pick(&no_page, Some(TAB)),
            Ok(("port".into(), "port".into()))
        );
        let no_server = Hooks {
            listener_dir: |_| None,
            ..no_page
        };
        assert_eq!(
            pick(&no_server, Some(TAB)),
            Ok(("terminal".into(), "terminal".into()))
        );
        // No tab at all: the terminal still counts.
        assert_eq!(
            pick(&no_page, None),
            Ok(("terminal".into(), "terminal".into()))
        );
        // Nothing to go on.
        let blind = Hooks {
            terminal: nothing,
            ..no_server
        };
        let reason = pick(&blind, Some(TAB)).unwrap_err();
        assert!(
            reason.contains("no process found listening on port 5173"),
            "{reason}"
        );
        assert!(
            pick(&blind, None)
                .unwrap_err()
                .contains("no browser tab or terminal")
        );
        // The tab URL is recorded with the decision.
        assert_eq!(
            decide(Some(TAB), &[], &Hooks { pinned, ..hooks() })
                .unwrap()
                .url
                .as_deref(),
            Some(TAB)
        );
    }

    #[test]
    fn auto_send_off_delivers_nothing_even_when_a_project_is_pinned() {
        let all = Hooks {
            pinned,
            sdk: page,
            ..hooks()
        };
        assert!(decide_auto(true, Some(TAB), &[GHOSTTY], &all).is_ok());
        assert_eq!(
            decide_auto(false, Some(TAB), &[GHOSTTY], &all),
            Err("autoSend is off".to_owned())
        );
    }

    #[test]
    fn send_without_a_folder_uses_the_explicit_one_then_the_recorded_one_then_the_ladder() {
        let dir =
            std::env::temp_dir().join(format!("pointo-send-{}.pointo", crate::make_bundle_id()));
        crate::generate_demo_bundle(Some(dir.clone())).unwrap();
        let explicit = base().join("pinned");
        let ladder = Hooks { pinned, ..hooks() };
        // An explicit --project wins over everything.
        assert_eq!(
            project_for_send_with(&dir, Some(explicit.clone()), &ladder).unwrap(),
            explicit
        );
        assert!(project_for_send_with(&dir, Some(base().join("missing")), &ladder).is_err());
        // Nothing recorded: the ladder (here the pinned project; no tab or terminal is known).
        assert_eq!(
            project_for_send_with(&dir, None, &ladder).unwrap(),
            explicit
        );
        let none = project_for_send_with(&dir, None, &hooks()).unwrap_err();
        assert!(format!("{none:#}").contains("pass --project"), "{none:#}");
        // A recorded destination beats the ladder.
        let (_, mut bundle) = crate::handoff::load_bundle(&dir).unwrap();
        let recorded = base().join("page");
        let dest = Destination {
            project: recorded.display().to_string(),
            via: "page".into(),
            url: None,
        };
        record_destination(&dir, &mut bundle, dest).unwrap();
        assert_eq!(
            project_for_send_with(&dir, None, &ladder).unwrap(),
            recorded
        );
        // ... unless that folder is gone.
        let (_, mut bundle) = crate::handoff::load_bundle(&dir).unwrap();
        let gone = Destination {
            project: base().join("gone").display().to_string(),
            via: "page".into(),
            url: None,
        };
        record_destination(&dir, &mut bundle, gone).unwrap();
        assert_eq!(
            project_for_send_with(&dir, None, &ladder).unwrap(),
            explicit
        );
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn the_home_folder_and_root_never_count() {
        // A dev server started from the home folder, then a shell at `/`, then nothing.
        let home = Hooks {
            listener_dir: home_listener,
            terminal: home_terminal,
            ..hooks()
        };
        let reason = decide(Some(TAB), &[GHOSTTY], &home).unwrap_err();
        assert!(reason.contains("not a project"), "{reason}");
        assert!(is_home_or_root(Path::new("/")));
        assert!(is_home_or_root(&dirs::home_dir().unwrap()));
        assert!(!is_home_or_root(base()));
        // Not even a pinned or registered folder that is the home folder.
        let pinned_home = Hooks {
            pinned: || dirs::home_dir(),
            ..home
        };
        assert!(decide(Some(TAB), &[], &pinned_home).is_err());
    }

    #[test]
    fn a_page_or_url_that_is_not_local_leaves_the_terminal_to_decide() {
        let hooks = Hooks {
            own_port: |_| None,
            ..hooks()
        };
        let dest = decide(Some("https://example.com/x"), &[GHOSTTY], &hooks).unwrap();
        assert_eq!(dest.via, "terminal");
        let reason = decide(Some("https://example.com/x"), &[], &hooks).unwrap_err();
        assert!(reason.contains("isn't served from this Mac"), "{reason}");
    }

    #[test]
    fn a_destination_is_recorded_in_the_bundle_and_its_summary() {
        let dir =
            std::env::temp_dir().join(format!("pointo-dest-{}.pointo", crate::make_bundle_id()));
        std::fs::create_dir_all(&dir).unwrap();
        let json = serde_json::json!({
            "version": 1, "id": "x", "createdAtMs": 1, "durationMs": 2000,
            "target": {"mode": "display", "displayId": 1,
                "frame": {"x": 0.0, "y": 0.0, "width": 100.0, "height": 100.0, "scale": 1.0}},
            "transcript": {"source": "none", "text": "", "segments": []},
            "strokes": [], "marks": [], "events": [], "keyframes": [],
            "contactSheet": "contact-sheet.png"
        });
        std::fs::write(dir.join("pointo.json"), json.to_string()).unwrap();
        let (_, mut bundle) = crate::handoff::load_bundle(&dir).unwrap();
        let dest = Destination {
            project: "/p/app".into(),
            via: "port".into(),
            url: Some("http://localhost:5173/".into()),
        };
        record_destination(&dir, &mut bundle, dest.clone()).unwrap();
        let (_, loaded) = crate::handoff::load_bundle(&dir).unwrap();
        assert_eq!(loaded.destination, Some(dest));
        let summary = std::fs::read_to_string(dir.join("summary.md")).unwrap();
        assert!(
            summary.contains("For project: app (/p/app) · page http://localhost:5173/"),
            "{summary}"
        );
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_bundle_that_named_a_session_still_loads_without_a_project() {
        let dir =
            std::env::temp_dir().join(format!("pointo-old-{}.pointo", crate::make_bundle_id()));
        std::fs::create_dir_all(&dir).unwrap();
        let json = serde_json::json!({
            "version": 1, "id": "x", "createdAtMs": 1, "durationMs": 2000,
            "target": {"mode": "display", "displayId": 1,
                "frame": {"x": 0.0, "y": 0.0, "width": 100.0, "height": 100.0, "scale": 1.0}},
            "transcript": {"source": "none", "text": "", "segments": []},
            "strokes": [], "marks": [], "events": [], "keyframes": [],
            "contactSheet": "contact-sheet.png",
            "destination": {"session": "ses_old", "title": "UP DOWN", "via": "sdk",
                "url": "http://localhost:5173/", "directory": "/p/app"}
        });
        std::fs::write(dir.join("pointo.json"), json.to_string()).unwrap();
        let (_, bundle) = crate::handoff::load_bundle(&dir).unwrap();
        // The old `directory` is the project the session was chosen by.
        assert_eq!(bundle.destination.as_ref().unwrap().project, "/p/app");

        let session_only = json["destination"].as_object().unwrap().clone();
        let mut only = json.clone();
        only["destination"] = serde_json::json!({"session": session_only["session"], "via": "sdk"});
        std::fs::write(dir.join("pointo.json"), only.to_string()).unwrap();
        let (_, bundle) = crate::handoff::load_bundle(&dir).unwrap();
        let dest = bundle.destination.unwrap();
        assert!(!dest.is_project());
        assert!(
            !crate::sketch::summary_markdown(&crate::handoff::load_bundle(&dir).unwrap().1, &dir)
                .contains("For project")
        );
        std::fs::remove_dir_all(dir).unwrap();
    }
}
