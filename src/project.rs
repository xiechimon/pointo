//! Delivering a capture to a project folder. Any coding agent working in that folder (Claude
//! Code, Codex, Cursor, Gemini CLI, Qwen Code, OpenCode…) reads captures from
//! `<project>/.pointo/captures/<name>/`; the newest one is named by `<project>/.pointo/latest`.
//!
//! A delivery copies what an agent reads (the contact sheet, keyframes, manifest and the
//! summary rewritten to point at the copy) and leaves the heavy media (`recording.mp4`,
//! `audio.wav`) in the original bundle, whose path the copied summary ends with so
//! `pointo zoom` and `pointo export` still reach it. `.pointo/` is added to the repository's
//! `.git/info/exclude` (never `.gitignore`), so a capture never lands in a commit.

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};

use crate::model::Destination;

/// The folder inside a project that holds captures.
pub const DIR: &str = ".pointo";
/// How many recent projects are remembered (`recentProjects`).
pub const MAX_RECENT: usize = 5;

const README: &str = "This folder holds screen captures (screen, voice and ink) made with Pointo for this project.\nRead the summary.md and contact-sheet.png inside the folder named by `latest` (a one-line file with its path) before changing anything the capture is about.\nOlder captures are in `captures/`. The folder is excluded from git.\n";

/// Files at the bundle's root that are heavy media, kept in the original bundle.
const HEAVY_ROOT_FILES: [&str; 4] = [
    "recording.mp4",
    "recording.mov",
    "audio.wav",
    "contact-sheet-full.png",
];

/// A folder's name, for chips, the HUD and the summary.
pub fn folder_name(path: &Path) -> String {
    path.file_name().map_or_else(
        || path.display().to_string(),
        |name| name.to_string_lossy().into_owned(),
    )
}

/// `projects` with `project` moved (or added) to the front, de-duplicated and cut to
/// [`MAX_RECENT`].
pub fn push_recent(projects: &[String], project: &str) -> Vec<String> {
    let mut out = vec![project.to_owned()];
    out.extend(projects.iter().filter(|p| p.as_str() != project).cloned());
    out.truncate(MAX_RECENT);
    out
}

/// Copies the bundle at `bundle_dir` into `project` (see the module docs) and returns the copy's
/// folder. The copy's `pointo.json` and `summary.md` record `project` as the destination.
pub fn deliver(bundle_dir: &Path, project: &Path) -> Result<PathBuf> {
    let (source, mut bundle) = crate::handoff::load_bundle(bundle_dir)?;
    ensure_folder(project)?;
    if !bundle
        .destination
        .as_ref()
        .is_some_and(|d| d.project == project.to_string_lossy())
    {
        bundle.destination = Some(Destination {
            project: project.to_string_lossy().into_owned(),
            via: "chosen".into(),
            url: bundle.destination.take().and_then(|d| d.url),
        });
    }
    let name = source
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .context("Bundle has no name")?;
    let name = name.strip_suffix(".pointo").unwrap_or(&name);
    let root = project.join(DIR);
    let copy = root.join("captures").join(name);
    if copy.exists() {
        fs::remove_dir_all(&copy)
            .with_context(|| format!("Could not replace {}", copy.display()))?;
    }
    fs::create_dir_all(&copy).with_context(|| format!("Could not create {}", copy.display()))?;

    let heavy = |file: &str| {
        HEAVY_ROOT_FILES.contains(&file)
            || bundle.video.as_deref() == Some(file)
            || bundle.audio.as_deref() == Some(file)
    };
    for entry in fs::read_dir(&source)?.flatten() {
        let file = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path();
        if file.starts_with('.') || file == "summary.md" || file == "pointo.json" || heavy(&file) {
            continue;
        }
        if path.is_file() {
            fs::copy(&path, copy.join(&file))?;
        }
    }
    let mut dirs = vec!["frames".to_owned(), "frames-full".to_owned()];
    dirs.extend(
        bundle
            .autocrop
            .as_ref()
            .map(|crop| crop.full_frames.clone()),
    );
    dirs.dedup();
    for dir in dirs {
        if source.join(&dir).is_dir() {
            copy_dir(&source.join(&dir), &copy.join(&dir))?;
        }
    }
    fs::write(
        copy.join("pointo.json"),
        serde_json::to_vec_pretty(&bundle)?,
    )?;

    // The summary's paths point into the copy; its last line names the original bundle for the
    // recording and audio, which stay there.
    let mut summary = crate::sketch::summary_markdown(&bundle, &copy);
    if !summary.ends_with('\n') {
        summary.push('\n');
    }
    summary.push_str(&format!(
        "Recording and audio stay in the original bundle: {} (pointo zoom/export read them there)\n",
        source.display()
    ));
    fs::write(copy.join("summary.md"), summary)?;

    fs::write(root.join("latest"), format!("{}\n", copy.display()))?;
    if fs::read_to_string(root.join("README.md")).ok().as_deref() != Some(README) {
        fs::write(root.join("README.md"), README)?;
    }
    exclude_from_git(project)?;
    Ok(copy)
}

/// [`deliver`] as a `delivery::Forward`: `project` is the folder's absolute path.
pub fn forward(bundle_dir: &Path, project: &str) -> Result<()> {
    deliver(bundle_dir, Path::new(project))?;
    crate::handoff::remember_project(project);
    Ok(())
}

fn ensure_folder(project: &Path) -> Result<()> {
    if !project.is_absolute() {
        bail!("{} is not an absolute path", project.display());
    }
    if !project.is_dir() {
        bail!("{} is not a folder", project.display());
    }
    Ok(())
}

fn copy_dir(from: &Path, to: &Path) -> Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)?.flatten() {
        let path = entry.path();
        let target = to.join(entry.file_name());
        if path.is_dir() {
            copy_dir(&path, &target)?;
        } else {
            fs::copy(&path, &target)?;
        }
    }
    Ok(())
}

/// Adds `.pointo/` to the `info/exclude` of the repository `project` is in, once. Nothing
/// happens outside a repository, and `.gitignore` is never touched.
fn exclude_from_git(project: &Path) -> Result<()> {
    let Some(exclude) = git_exclude_file(project) else {
        return Ok(());
    };
    let entry = format!("{DIR}/");
    let current = fs::read_to_string(&exclude).unwrap_or_default();
    if current.lines().any(|line| {
        matches!(
            line.trim(),
            ".pointo/" | ".pointo" | "/.pointo/" | "/.pointo"
        )
    }) {
        return Ok(());
    }
    if let Some(parent) = exclude.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut next = current;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(&entry);
    next.push('\n');
    fs::write(&exclude, next).with_context(|| format!("Could not write {}", exclude.display()))
}

/// `info/exclude` of the repository holding `dir`: under its `.git` folder, or for a worktree
/// (a `.git` file) under the repository its `commondir` names.
fn git_exclude_file(dir: &Path) -> Option<PathBuf> {
    let mut current = Some(dir);
    while let Some(path) = current {
        let git = path.join(".git");
        if git.is_dir() {
            return Some(git.join("info/exclude"));
        }
        if git.is_file() {
            let text = fs::read_to_string(&git).ok()?;
            let gitdir = PathBuf::from(text.trim().strip_prefix("gitdir:")?.trim());
            let gitdir = if gitdir.is_absolute() {
                gitdir
            } else {
                path.join(gitdir)
            };
            let common = fs::read_to_string(gitdir.join("commondir"))
                .map_or(gitdir.clone(), |c| gitdir.join(c.trim()));
            return Some(common.join("info/exclude"));
        }
        current = path.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "pointo-project-{label}-{}",
            crate::make_bundle_id()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// The demo bundle (contact sheet, frames, manifest, summary) plus what a real recording
    /// adds: video, audio, full frames, a timeline and a retry marker.
    fn bundle_with_media(root: &Path, project: Option<&Path>) -> PathBuf {
        let dir = root.join("pointo-1700000000000-abc.pointo");
        crate::generate_demo_bundle(Some(dir.clone())).unwrap();
        fs::create_dir_all(dir.join("frames-full")).unwrap();
        for file in [
            "frames-full/frame-01.png",
            "recording.mp4",
            "audio.wav",
            "timeline.json",
            ".deliver.json",
        ] {
            fs::write(dir.join(file), file).unwrap();
        }
        fs::write(dir.join("summary.md"), "old summary").unwrap();
        if let Some(project) = project {
            let (_, mut bundle) = crate::handoff::load_bundle(&dir).unwrap();
            bundle.destination = Some(Destination {
                project: project.display().to_string(),
                via: "page".into(),
                url: None,
            });
            fs::write(
                dir.join("pointo.json"),
                serde_json::to_vec(&bundle).unwrap(),
            )
            .unwrap();
        }
        dir
    }

    fn repo(root: &Path) -> PathBuf {
        let repo = root.join("app");
        fs::create_dir_all(repo.join(".git/info")).unwrap();
        repo
    }

    fn count(haystack: &str, needle: &str) -> usize {
        haystack.matches(needle).count()
    }

    #[test]
    fn delivery_copies_what_agents_read_and_leaves_heavy_media() {
        let root = temp("deliver");
        let repo = repo(&root);
        let bundle = bundle_with_media(&root, None);
        let copy = deliver(&bundle, &repo).unwrap();

        assert_eq!(copy, repo.join(".pointo/captures/pointo-1700000000000-abc"));
        for kept in [
            "contact-sheet.png",
            "frames/frame-01.png",
            "frames-full/frame-01.png",
            "pointo.json",
            "timeline.json",
            "summary.md",
        ] {
            assert!(copy.join(kept).is_file(), "{kept} should be copied");
        }
        for skipped in ["recording.mp4", "audio.wav", ".deliver.json"] {
            assert!(!copy.join(skipped).exists(), "{skipped} should stay behind");
        }

        // Paths in the summary point into the copy; the original is named for the media.
        let summary = fs::read_to_string(copy.join("summary.md")).unwrap();
        assert!(
            summary.starts_with("[pointo 0:09 · Notes")
                && summary
                    .lines()
                    .next()
                    .unwrap()
                    .ends_with(&format!("· {}]", copy.display())),
            "{summary}"
        );
        assert!(summary.contains(&format!("For project: app ({})", repo.display())));
        // The original bundle as `load_bundle` resolves it (Windows: long names, not 8.3 ones).
        let (original, _) = crate::handoff::load_bundle(&bundle).unwrap();
        assert!(summary.contains(&original.display().to_string()), "{summary}");
        assert!(!summary.contains("old summary"));

        // `latest` names the copy; the README tells an agent what the folder is.
        assert_eq!(
            fs::read_to_string(repo.join(".pointo/latest")).unwrap(),
            format!("{}\n", copy.display())
        );
        let readme = fs::read_to_string(repo.join(".pointo/README.md")).unwrap();
        assert!(readme.contains("latest") && readme.contains("summary.md"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_repository_excludes_pointo_once_and_gitignore_stays_untouched() {
        let root = temp("exclude");
        let repo = repo(&root);
        fs::write(repo.join(".git/info/exclude"), "# local\n*.swp").unwrap();
        let bundle = bundle_with_media(&root, None);
        deliver(&bundle, &repo).unwrap();
        deliver(&bundle, &repo).unwrap();
        let exclude = fs::read_to_string(repo.join(".git/info/exclude")).unwrap();
        assert_eq!(exclude, "# local\n*.swp\n.pointo/\n");
        assert_eq!(count(&exclude, ".pointo"), 1);
        assert!(!repo.join(".gitignore").exists());

        // A subfolder of the repository excludes through the same file.
        let nested = repo.join("web");
        fs::create_dir_all(&nested).unwrap();
        deliver(&bundle, &nested).unwrap();
        let exclude = fs::read_to_string(repo.join(".git/info/exclude")).unwrap();
        assert_eq!(count(&exclude, ".pointo/"), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_folder_outside_a_repository_gets_no_exclude_and_a_missing_one_is_refused() {
        let root = temp("plain");
        let bundle = bundle_with_media(&root, None);
        let plain = root.join("notes");
        fs::create_dir_all(&plain).unwrap();
        deliver(&bundle, &plain).unwrap();
        assert!(plain.join(".pointo/latest").is_file());
        assert!(!plain.join(".git").exists());
        assert!(deliver(&bundle, &root.join("missing")).is_err());
        assert!(!root.join("missing").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_worktree_excludes_through_its_common_repository() {
        let root = temp("worktree");
        let main = repo(&root);
        let gitdir = main.join(".git/worktrees/feature");
        fs::create_dir_all(&gitdir).unwrap();
        fs::write(gitdir.join("commondir"), "../..\n").unwrap();
        let tree = root.join("feature");
        fs::create_dir_all(&tree).unwrap();
        fs::write(tree.join(".git"), format!("gitdir: {}\n", gitdir.display())).unwrap();
        deliver(&bundle_with_media(&root, None), &tree).unwrap();
        let exclude =
            fs::read_to_string(main.join(".git/worktrees/feature/../../info/exclude")).unwrap();
        assert!(exclude.contains(".pointo/"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delivering_again_replaces_the_copy_and_moves_latest() {
        let root = temp("again");
        let repo = repo(&root);
        let first = bundle_with_media(&root, Some(&repo));
        let copy = deliver(&first, &repo).unwrap();
        fs::write(copy.join("stale.txt"), "x").unwrap();
        let again = deliver(&first, &repo).unwrap();
        assert_eq!(copy, again);
        assert!(!again.join("stale.txt").exists());
        // A page-chosen destination survives: it is already this project.
        let json = fs::read_to_string(again.join("pointo.json")).unwrap();
        assert!(json.contains("\"via\": \"page\""), "{json}");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recent_projects_dedupe_keep_order_and_cap_at_five() {
        let mut list: Vec<String> = Vec::new();
        for project in ["/a", "/b", "/c", "/d", "/e", "/f"] {
            list = push_recent(&list, project);
        }
        assert_eq!(list, ["/f", "/e", "/d", "/c", "/b"]);
        assert_eq!(push_recent(&list, "/d"), ["/d", "/f", "/e", "/c", "/b"]);
        assert_eq!(push_recent(&list, "/g"), ["/g", "/f", "/e", "/d", "/c"]);
        assert_eq!(push_recent(&[], "/a"), ["/a"]);
    }

    #[test]
    fn folder_names_are_the_last_component() {
        assert_eq!(folder_name(Path::new("/Users/me/code/app")), "app");
        assert_eq!(folder_name(Path::new("/")), "/");
    }
}
