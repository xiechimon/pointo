# Vendored gpui 0.2.2

This is the crates.io `gpui` 0.2.2 package, wired in through
`[patch.crates-io]` in the root `Cargo.toml`. Commit "Vendor gpui 0.2.2
verbatim" holds the untouched copy; `git diff <that commit> -- vendor/gpui`
shows every change. Keep changes small and listed here.

## Changes

1. **Line breaking follows UAX #14** (`src/text_system/line_wrapper.rs`
   `LineWrapper::break_indices`, used by `wrap_line` and by
   `LineLayout::compute_wrap_boundaries` in `line_layout.rs`, which is the path
   every `div().child(text)` takes). Upstream 0.2.2 let a line start before any
   non-letter, so `，` and `。` began lines and `Alt+Shift+S` split at `+`.
   Break opportunities now come from the `unicode-linebreak` crate. Upstream Zed
   made the same switch in zed-industries/zed PR 64624 (using `icu_segmenter`);
   `is_word_char` and its test were removed with the old rule.
   Tests: `src/cjk_line_break.rs` at the repo root (`cargo test cjk_line_break`).
2. **`test-support` no longer enables `wayland`, `x11` or
   `util/test-support`**, so Pointo's dev-dependency on `gpui/test-support`
   builds on macOS and Windows without the Linux renderer or libgit2, and adds
   almost nothing to `Cargo.lock`.

## Dropping this copy

When a gpui release on crates.io contains PR 64624, delete `vendor/gpui` and
the `[patch.crates-io]` entry, bump `gpui`, and keep `src/cjk_line_break.rs`
as the check.
