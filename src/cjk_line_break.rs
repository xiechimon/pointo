//! Chinese line breaking in GPUI text (onboarding, settings, every window on
//! Windows). Wraps real app copy through `WindowTextSystem::shape_text`, the
//! path `div().child(text)` takes, at every width from narrow to one line.
//!
//! The test platform gives every glyph the same advance (0.6 em), so a width
//! of `n` columns is `n * 0.6 * FONT_SIZE` on every OS.

use gpui::{Hsla, SharedString, TestAppContext, TextRun, font, px};

const FONT_SIZE: f32 = 10.0;
const COLUMN: f32 = FONT_SIZE * 0.6;

/// Text from the Windows onboarding and settings panes.
const COPY: &[&str] = &[
    "Qwen3-ASR 在这台电脑上运行，听得懂普通话、粤语和中英混说，录音不会上传。",
    "轻按 Alt+Shift+S 录制指针所在的屏幕，或按住 Alt+Shift+S 选择窗口或区域。",
    "录完后按 Ctrl+V 粘贴到任意 AI 对话里（文字、截图和录屏都会一起带上）。",
    "说“开始”或者“停止”就能控制录制：《Pointo 使用指南》里有完整说明。",
];

/// Must never start a line.
const CLOSING: &str = "，。、；：！？）》」』】”’";
/// Must never end a line.
const OPENING: &str = "（《「『【“‘";
/// Must never be split across a line that is wide enough to hold them.
const SHORTCUTS: &[&str] = &["Alt+Shift+S", "Ctrl+V"];

/// Byte offsets where `shape_text` starts a new visual line.
fn wrap_offsets(cx: &mut TestAppContext, text: &str, columns: usize) -> Vec<usize> {
    let cx = cx.add_empty_window();
    let text = SharedString::from(text.to_string());
    cx.update(|window, _| {
        let run = TextRun {
            len: text.len(),
            font: font("Test"),
            color: Hsla::default(),
            background_color: None,
            underline: None,
            strikethrough: None,
        };
        let lines = window
            .text_system()
            .shape_text(
                text.clone(),
                px(FONT_SIZE),
                &[run],
                Some(px(COLUMN * columns as f32 + 0.5)),
                None,
            )
            .unwrap();
        assert_eq!(lines.len(), 1, "copy has no hard line breaks");
        let layout = &lines[0].unwrapped_layout;
        lines[0]
            .wrap_boundaries
            .iter()
            .map(|b| layout.runs[b.run_ix].glyphs[b.glyph_ix].index)
            .collect()
    })
}

fn split_lines(text: &str, offsets: &[usize]) -> Vec<String> {
    let mut lines = Vec::new();
    let mut start = 0;
    for &offset in offsets {
        lines.push(text[start..offset].to_string());
        start = offset;
    }
    lines.push(text[start..].to_string());
    lines
}

/// Every rule violation in `text` wrapped at `columns`, as readable strings.
fn violations(cx: &mut TestAppContext, text: &str, columns: usize) -> Vec<String> {
    let offsets = wrap_offsets(cx, text, columns);
    let lines = split_lines(text, &offsets);
    let mut found = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        let shown = format!("{columns} columns, line {}: {line:?}", i + 1);
        if i > 0 && line.chars().next().is_some_and(|c| CLOSING.contains(c)) {
            found.push(format!("starts with closing punctuation — {shown}"));
        }
        if i + 1 < lines.len()
            && line
                .trim_end()
                .chars()
                .last()
                .is_some_and(|c| OPENING.contains(c))
        {
            found.push(format!("ends with opening bracket — {shown}"));
        }
    }
    // A line narrower than the shortcut itself has to cut it somewhere, like
    // any overlong word.
    for shortcut in SHORTCUTS.iter().filter(|s| s.len() <= columns) {
        for (start, _) in text.match_indices(shortcut) {
            let end = start + shortcut.len();
            if offsets.iter().any(|&o| o > start && o < end) {
                found.push(format!("splits {shortcut} — {columns} columns: {lines:?}"));
            }
        }
    }
    found
}

#[gpui::test]
fn closing_punctuation_never_starts_a_line(cx: &mut TestAppContext) {
    let mut found = Vec::new();
    for text in COPY {
        for columns in 6..=text.chars().count() {
            found.extend(violations(cx, text, columns));
        }
    }
    assert!(
        found.is_empty(),
        "{} wrap errors:\n{}",
        found.len(),
        found.join("\n")
    );
}

/// The two strings and widths seen broken on the Windows VM: `，` and `+S`
/// pushed to the start of a line.
#[gpui::test]
fn known_bad_wraps_are_fixed(cx: &mut TestAppContext) {
    let asr = COPY[0];
    // 18 columns: the old rule put `，` alone at the start of line 2.
    let lines = split_lines(asr, &wrap_offsets(cx, asr, 18));
    assert!(
        lines.iter().skip(1).all(|l| !l.starts_with('，')),
        "{lines:?}"
    );

    let shortcut = COPY[1];
    // The old rule broke before `+` at 11–14, 16–20 and 32–40 columns.
    for columns in 11..=40 {
        let lines = split_lines(shortcut, &wrap_offsets(cx, shortcut, columns));
        assert!(
            lines
                .iter()
                .all(|l| !l.starts_with('+') && !l.trim_end().ends_with('+')),
            "{columns} columns: {lines:?}"
        );
    }
}

/// Plain CJK still wraps between any two ideographs, and English still wraps
/// at spaces — the fix must not make lines overflow.
#[gpui::test]
fn ordinary_breaks_still_happen(cx: &mut TestAppContext) {
    let han = "这是一段没有标点的中文文字用来检查换行";
    let lines = split_lines(han, &wrap_offsets(cx, han, 5));
    assert!(lines.iter().all(|l| l.chars().count() <= 5), "{lines:?}");

    let latin = "press the shortcut again to stop";
    let lines = split_lines(latin, &wrap_offsets(cx, latin, 12));
    assert_eq!(lines, ["press the ", "shortcut ", "again to ", "stop"]);
}
