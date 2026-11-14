//! Words and timing for engines that return text only (Qwen3-ASR, a `transcribeCommand`): the
//! recording is cut into speech islands (`audio::speech_islands`, planned by `plan_clips`), each
//! island is transcribed on its own, and its words are spread across it by length
//! (`spread_words`). Those times are estimates (`TranscriptData::estimated`): they place words
//! inside the right island but not on the right syllable, so spoken cues never cut keyframes
//! from them. Also where Hex keeps model files Pointo may reuse (`support_dirs`).

use std::path::PathBuf;

use crate::model::{TranscriptSegment, WordTiming};

const MIN_ISLAND_MS: u64 = 120;
const MAX_FORCED_MERGE_MS: u64 = 8 * 60_000;
/// Clips past this are only for recordings too long for it (see `plan_clips`).
const MAX_CLIPS: usize = 24;

/// How islands become clips. Qwen3-ASR ends every request with a full stop, so a short island
/// comes back as a sentence of its own: clips must hold whole thoughts, which means joining
/// islands across breathing and thinking pauses (a speaker leaves ~1-2 s between phrases of one
/// sentence), up to a length the model handles well.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ClipLimits {
    /// Islands closer than this belong to one clip.
    pub merge_gap_ms: u64,
    /// The longest clip a merge may build.
    pub max_clip_ms: u64,
}

impl ClipLimits {
    /// Qwen3-ASR: join across pauses under 2 s, clips up to 30 s (`for_model` lowers the cap to
    /// what the loaded model reports).
    pub const QWEN: ClipLimits = ClipLimits {
        merge_gap_ms: 2_000,
        max_clip_ms: 30_000,
    };

    /// `QWEN`, with the cap lowered so a clip plus `pad_ms` of silence either side fits the
    /// model's `max_audio_ms` (`0` = no limit).
    pub fn for_model(max_audio_ms: i64, pad_ms: u64) -> ClipLimits {
        let mut limits = ClipLimits::QWEN;
        if max_audio_ms > 0 {
            let room = (max_audio_ms as u64).saturating_sub(2 * pad_ms).max(1_000);
            limits.max_clip_ms = limits.max_clip_ms.min(room);
        }
        limits
    }
}

/// Where Hex may keep its data, in the order Pointo tries them: `HEX_APPLICATION_SUPPORT_DIR`
/// alone when set, else `hex` in the OS data folder (`~/Library/Application Support`,
/// `%APPDATA%`, `$XDG_DATA_HOME` or `~/.local/share`), where Hex 3 keeps it on every OS, then
/// `voice-control`, where older Hex kept it. Hex 3 leaves an old `voice-control` folder alone, so
/// its stale files must never win over `hex`.
pub fn support_dirs() -> Vec<PathBuf> {
    if let Some(dir) = std::env::var_os("HEX_APPLICATION_SUPPORT_DIR")
        .map(PathBuf::from)
        .filter(|dir| !dir.as_os_str().is_empty())
    {
        return vec![dir];
    }
    let data = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    vec![data.join("hex"), data.join("voice-control")]
}

/// Speech spans worth one request each: tiny blips dropped, near neighbours joined so a clip
/// holds whole phrases (`limits`), and at most `MAX_CLIPS` unless that would build a clip past
/// `limits.max_clip_ms`, which the model could not take.
pub fn plan_clips(islands: &[(u64, u64)], duration_ms: u64, limits: ClipLimits) -> Vec<(u64, u64)> {
    let mut clips: Vec<(u64, u64)> = Vec::new();
    for &(start, end) in islands {
        let (start, end) = (start.min(duration_ms), end.min(duration_ms));
        if end.saturating_sub(start) < MIN_ISLAND_MS {
            continue;
        }
        match clips.last_mut() {
            Some(last)
                if start.saturating_sub(last.1) < limits.merge_gap_ms
                    && end - last.0 <= limits.max_clip_ms =>
            {
                last.1 = end;
            }
            _ => clips.push((start, end)),
        }
    }
    let forced_max = MAX_FORCED_MERGE_MS.min(limits.max_clip_ms);
    while clips.len() > MAX_CLIPS {
        let Some(index) = (1..clips.len())
            .filter(|&i| clips[i].1 - clips[i - 1].0 <= forced_max)
            .min_by_key(|&i| clips[i].0 - clips[i - 1].1)
        else {
            break;
        };
        clips[index - 1].1 = clips[index].1;
        clips.remove(index);
    }
    clips
}

const DANGLING_ZH: &[&str] = &[
    "然后", "但是", "不过", "所以", "因为", "如果", "而且", "或者", "并且", "以及", "还有", "就是",
    "这个", "那个", "其实", "比如", "另外", "同时", "和", "与", "跟", "把", "被", "对于", "关于",
];
const DANGLING_EN: &[&str] = &[
    "and", "but", "so", "then", "or", "the", "a", "an", "to", "of", "in", "on", "with", "because",
    "if", "that", "which", "for", "as", "when", "while",
];

/// `text` as the end of a clip whose speech goes on in `next` (when there is one): Qwen3-ASR
/// closes every clip with a full stop, so a fragment that clearly continues gets a comma instead.
/// It continues when `split_mid_speech` (the clip was cut at its length cap, not at a pause),
/// when it ends on a word no sentence ends with (`然后`, `and`, `the`), or when `next` carries on
/// in lower-case Latin after Latin text. A last clip, a question, an exclamation and any other
/// finished thought keep their stop.
pub fn soften_clip_end(text: &str, next: Option<&str>, split_mid_speech: bool) -> String {
    let (body, comma) = if let Some(body) = text.strip_suffix('。') {
        (body, '，')
    } else if let Some(body) = text.strip_suffix('.').filter(|body| !body.ends_with('.')) {
        (body, ',')
    } else {
        return text.to_owned();
    };
    let Some(next) = next else {
        return text.to_owned();
    };
    let trimmed = body.trim_end_matches(['，', ',', ' ']);
    let last_word = trimmed
        .rsplit(|c: char| c.is_whitespace() || is_cjk(c))
        .next()
        .unwrap_or("");
    let dangling = DANGLING_ZH.iter().any(|word| trimmed.ends_with(word))
        || DANGLING_EN.contains(&last_word.to_ascii_lowercase().as_str());
    let carries_on = trimmed.chars().last().is_some_and(|c| c.is_ascii_alphanumeric())
        && next.chars().next().is_some_and(|c| c.is_ascii_lowercase());
    if split_mid_speech || dangling || carries_on {
        format!("{body}{comma}")
    } else {
        text.to_owned()
    }
}

fn ends_sentence(word: &str) -> bool {
    word.trim_end_matches(['"', '\'', '”', '’', ')', ']'])
        .ends_with(['.', '!', '?', ';', ':', '。', '！', '？', '；'])
}

/// Han, kana, hangul and their punctuation: written without spaces between words.
fn is_cjk(c: char) -> bool {
    matches!(c as u32,
        0x2E80..=0x2FDF | 0x3000..=0x303F | 0x3040..=0x30FF | 0x3100..=0x312F | 0x3190..=0x31FF
        | 0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xAC00..=0xD7AF | 0xF900..=0xFAFF
        | 0xFE30..=0xFE4F | 0xFF00..=0xFF65 | 0x20000..=0x2FA1F)
}

/// Punctuation that belongs to the word before it.
fn is_cjk_punctuation(c: char) -> bool {
    matches!(c, '，' | '。' | '！' | '？' | '；' | '：' | '、' | '）' | '」' | '』' | '》' | '”' | '’' | '…')
}

/// The words of `text`: whitespace-separated runs, with every CJK character its own word and
/// CJK punctuation kept on the word before it.
fn tokens(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for run in text.split_whitespace() {
        let mut latin = String::new();
        for c in run.chars() {
            if is_cjk_punctuation(c) {
                if !latin.is_empty() {
                    out.push(std::mem::take(&mut latin));
                }
                match out.last_mut() {
                    Some(last) => last.push(c),
                    None => out.push(c.to_string()),
                }
            } else if is_cjk(c) {
                if !latin.is_empty() {
                    out.push(std::mem::take(&mut latin));
                }
                out.push(c.to_string());
            } else {
                latin.push(c);
            }
        }
        if !latin.is_empty() {
            out.push(latin);
        }
    }
    out
}

/// Whether two neighbouring characters from different words need a space between them: not
/// between two CJK characters or beside CJK punctuation.
pub fn spaced(last: char, first: char) -> bool {
    !((is_cjk(last) && is_cjk(first)) || is_cjk_punctuation(last) || is_cjk_punctuation(first))
}

/// Joins words (or transcript pieces) the way the language writes them: no space between two CJK
/// characters or beside CJK punctuation, a space everywhere else (`打开 Settings 页面`).
pub fn join_tokens<'a>(tokens: impl IntoIterator<Item = &'a str>) -> String {
    let mut text = String::new();
    for token in tokens {
        let (Some(last), Some(first)) = (text.chars().last(), token.chars().next()) else {
            text.push_str(token);
            continue;
        };
        if spaced(last, first) {
            text.push(' ');
        }
        text.push_str(token);
    }
    text
}

/// Spreads `text` over `start..end`, each word's share weighted by its length. Words tile the
/// span exactly (no gaps, no overlap), so the first begins at `start` and the last ends at `end`.
pub fn spread_words(text: &str, start: u64, end: u64) -> (Vec<TranscriptSegment>, Vec<WordTiming>) {
    let tokens = tokens(text);
    let end = end.max(start);
    let total: u128 = tokens
        .iter()
        .map(|token| token.chars().count().max(1) as u128)
        .sum();
    let mut words: Vec<WordTiming> = Vec::with_capacity(tokens.len());
    let mut segments = Vec::new();
    let mut segment_start = 0;
    let mut weight: u128 = 0;
    for (index, token) in tokens.iter().enumerate() {
        let at = |weight: u128| start + (u128::from(end - start) * weight / total) as u64;
        let t0 = at(weight);
        weight += token.chars().count().max(1) as u128;
        words.push(WordTiming {
            t0,
            t1: at(weight),
            text: token.clone(),
        });
        if ends_sentence(token) || index + 1 == tokens.len() {
            let phrase = &words[segment_start..];
            segments.push(TranscriptSegment {
                t0: phrase[0].t0,
                t1: phrase[phrase.len() - 1].t1,
                text: join_tokens(phrase.iter().map(|word| word.text.as_str())),
            });
            segment_start = words.len();
        }
    }
    (segments, words)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The old fixed rule (merge under 0.7 s, 30 s clips), for the tests of the mechanics.
    const SHORT: ClipLimits = ClipLimits {
        merge_gap_ms: 700,
        max_clip_ms: 30_000,
    };

    #[test]
    fn chinese_is_split_into_sentences_and_joined_without_spaces() {
        let (segments, words) = spread_words("你好世界。我们走吧", 0, 900);
        let texts: Vec<&str> = segments.iter().map(|s| s.text.as_str()).collect();
        assert_eq!(texts, ["你好世界。", "我们走吧"]);
        // Eight words: the full stop rides on 界.
        assert_eq!(words.len(), 8);
        assert_eq!((words[0].t0, words[7].t1), (0, 900));
    }

    #[test]
    fn mixed_chinese_and_english_keep_spaces_only_between_latin_words() {
        let (segments, _) = spread_words("打开 Settings 页面，点 Save 按钮", 0, 1000);
        let joined: Vec<&str> = segments.iter().map(|s| s.text.as_str()).collect();
        assert_eq!(joined, ["打开 Settings 页面，点 Save 按钮"]);
        let (segments, _) = spread_words("open the Settings page. then save", 0, 1000);
        assert_eq!(segments[0].text, "open the Settings page.");
    }

    #[test]
    fn spreading_tiles_the_span_by_word_length() {
        let (segments, words) = spread_words("Hi there. Longer words follow", 1_000, 2_000);
        assert_eq!(words.first().unwrap().t0, 1_000);
        assert_eq!(words.last().unwrap().t1, 2_000);
        assert!(words.windows(2).all(|pair| pair[0].t1 == pair[1].t0));
        assert!(words.iter().all(|word| word.t0 <= word.t1));
        let length = |i: usize| words[i].t1 - words[i].t0;
        assert!(length(3) > length(0), "longer words get longer spans");
        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0].text, "Hi there.");
        assert_eq!((segments[0].t0, segments[1].t1), (1_000, 2_000));
        assert_eq!(segments[0].t1, words[1].t1);
        assert_eq!(spread_words("  ", 0, 10), (vec![], vec![]));
        let (_, instant) = spread_words("a b", 500, 500);
        assert!(instant.iter().all(|word| word.t0 == 500 && word.t1 == 500));
    }

    #[test]
    fn clips_drop_blips_merge_neighbours_and_stay_bounded() {
        assert_eq!(
            plan_clips(
                &[(0, 50), (1_000, 1_500), (1_900, 2_400), (5_000, 5_300)],
                10_000,
                SHORT
            ),
            vec![(1_000, 2_400), (5_000, 5_300)]
        );
        assert!(plan_clips(&[], 1_000, SHORT).is_empty());
        let many: Vec<_> = (0..100).map(|i| (i * 2_000, i * 2_000 + 500)).collect();
        let clips = plan_clips(&many, 300_000, SHORT);
        assert!(clips.len() <= MAX_CLIPS);
        assert_eq!(clips[0].0, 0);
        assert_eq!(clips.last().unwrap().1, 99 * 2_000 + 500);
        assert!(clips.windows(2).all(|pair| pair[0].1 <= pair[1].0));
        // A long unbroken stretch is not glued to its neighbour.
        assert_eq!(
            plan_clips(&[(0, 29_800), (30_000, 31_000)], 40_000, SHORT).len(),
            2
        );
    }

    #[test]
    fn a_qwen_clip_spans_natural_pauses_so_sentences_stay_whole() {
        // Pauses of 1.8 s between islands are breaths and thinking, not the end of the thought.
        assert_eq!(
            plan_clips(&[(0, 2_000), (3_800, 5_000), (6_800, 9_000)], 20_000, ClipLimits::QWEN),
            vec![(0, 9_000)]
        );
        // Longer silences end the clip, and a merge never builds one past the cap.
        assert_eq!(
            plan_clips(&[(0, 2_000), (4_500, 5_000)], 20_000, ClipLimits::QWEN).len(),
            2
        );
        assert_eq!(
            plan_clips(&[(0, 20_000), (21_000, 40_000)], 60_000, ClipLimits::QWEN),
            vec![(0, 20_000), (21_000, 40_000)]
        );
        // A model that takes less than 30 s lowers the cap, padding included.
        assert_eq!(ClipLimits::for_model(20_000, 200).max_clip_ms, 19_600);
        assert_eq!(ClipLimits::for_model(0, 200), ClipLimits::QWEN);
        assert_eq!(ClipLimits::for_model(120_000, 200), ClipLimits::QWEN);
    }

    #[test]
    fn a_fragment_that_clearly_continues_loses_its_full_stop() {
        // The recorded Chinese session: each short island came back ending in 。.
        assert_eq!(
            soften_clip_end("允许切换模式的，然后。", Some("算了，暂时不允许吧。"), false),
            "允许切换模式的，然后，"
        );
        assert_eq!(soften_clip_end("we should keep it and.", Some("Then we go."), false), "we should keep it and,");
        // Cut at the length cap while still speaking: the next clip carries on.
        assert_eq!(soften_clip_end("这个设置在这里。", Some("也可以留着。"), true), "这个设置在这里，");
        // Lower-case Latin carrying on in the next clip.
        assert_eq!(soften_clip_end("Open the pane.", Some("and then save it."), false), "Open the pane,");
        // Real sentence ends stay, as do questions, last clips and finished thoughts.
        assert_eq!(soften_clip_end("这个可以留着。", Some("然后再看下一个。"), false), "这个可以留着。");
        assert_eq!(soften_clip_end("可以吗？", Some("and so on"), true), "可以吗？");
        assert_eq!(soften_clip_end("好，然后。", None, false), "好，然后。");
        assert_eq!(soften_clip_end("Open the pane.", Some("Then save it."), false), "Open the pane.");
    }
}
