//! Words and timing for engines that return text only (Qwen3-ASR, a `transcribeCommand`): the
//! recording is cut into speech islands (`audio::speech_islands`, planned by `plan_clips`), each
//! island is transcribed on its own, and its words are spread across it by length
//! (`spread_words`). Those times are estimates (`TranscriptData::estimated`): they place words
//! inside the right island but not on the right syllable, so spoken cues never cut keyframes
//! from them. Also where Hex keeps model files Pointo may reuse (`support_dirs`).

use std::path::PathBuf;

use crate::model::{TranscriptSegment, WordTiming};

const MIN_ISLAND_MS: u64 = 120;
const MERGE_GAP_MS: u64 = 700;
const MAX_MERGED_MS: u64 = 30_000;
const MAX_FORCED_MERGE_MS: u64 = 8 * 60_000;
const MAX_CLIPS: usize = 24;

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
/// holds whole phrases, and never more than `MAX_CLIPS`.
pub fn plan_clips(islands: &[(u64, u64)], duration_ms: u64) -> Vec<(u64, u64)> {
    let mut clips: Vec<(u64, u64)> = Vec::new();
    for &(start, end) in islands {
        let (start, end) = (start.min(duration_ms), end.min(duration_ms));
        if end.saturating_sub(start) < MIN_ISLAND_MS {
            continue;
        }
        match clips.last_mut() {
            Some(last)
                if start.saturating_sub(last.1) < MERGE_GAP_MS && end - last.0 <= MAX_MERGED_MS =>
            {
                last.1 = end;
            }
            _ => clips.push((start, end)),
        }
    }
    while clips.len() > MAX_CLIPS {
        let Some(index) = (1..clips.len())
            .filter(|&i| clips[i].1 - clips[i - 1].0 <= MAX_FORCED_MERGE_MS)
            .min_by_key(|&i| clips[i].0 - clips[i - 1].1)
        else {
            break;
        };
        clips[index - 1].1 = clips[index].1;
        clips.remove(index);
    }
    clips
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
                10_000
            ),
            vec![(1_000, 2_400), (5_000, 5_300)]
        );
        assert!(plan_clips(&[], 1_000).is_empty());
        let many: Vec<_> = (0..100).map(|i| (i * 2_000, i * 2_000 + 500)).collect();
        let clips = plan_clips(&many, 300_000);
        assert!(clips.len() <= MAX_CLIPS);
        assert_eq!(clips[0].0, 0);
        assert_eq!(clips.last().unwrap().1, 99 * 2_000 + 500);
        assert!(clips.windows(2).all(|pair| pair[0].1 <= pair[1].0));
        // A long unbroken stretch is not glued to its neighbour.
        assert_eq!(
            plan_clips(&[(0, 29_800), (30_000, 31_000)], 40_000).len(),
            2
        );
    }
}
