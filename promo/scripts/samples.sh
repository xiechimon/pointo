#!/usr/bin/env bash
# Install huashu-motion's real-instrument pack where api.github.com is unreachable (e.g. behind a
# proxy that only allows git and raw.githubusercontent.com). `om samples build` lists each source
# repository through the GitHub API; this writes the same listings from git instead, then builds the
# instruments the score uses (guitar and electric bass come from release archives and are skipped).
set -euo pipefail
cache="$(node -e "import('huashu-motion/cli/lib/samples.js').then(m=>console.log(m.packDir()))" 2>/dev/null || echo "$HOME/.cache/huashu-motion/samples")/.src"
work="$(mktemp -d)"
mkdir -p "$cache"
while read -r repo sha; do
  dir="$work/${repo/\//_}"
  git clone -q --filter=blob:none --no-checkout "https://github.com/$repo.git" "$dir"
  git -C "$dir" fetch -q --filter=blob:none origin "$sha"
  git -C "$dir" ls-tree -r --name-only "$sha" |
    python3 -c 'import json,sys; json.dump({"tree":[{"type":"blob","path":p.strip()} for p in sys.stdin if p.strip()]}, sys.stdout)' \
    > "$cache/${repo/\//_}@${sha:0:8}.json"
done <<'LIST'
sgossner/VSCO-2-CE 440300901dfe9275fd84e0b7763af1f8443ae62e
sgossner/VCSL c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e
sfzinstruments/GregSullivan.E-Pianos 8c3e581acda3594b553948ff0222d4f84a698376
sfzinstruments/SalamanderGrandPiano 3382bf9496bba2486f5ab0de55a264d1dfc38404
sfzinstruments/aliexpress-erhu 6615047b2fd06126877483e97b8bb4af9d00b080
sfzinstruments/body_percussion 4ac9d8966679c648b62fa10a188179e186b97f24
sfzinstruments/karoryfer.unruly-drums 9bf75c2a1392f190cd1c264645653629f0b3a097
sfzinstruments/karoryfer.big-rusty-drums f07ce00df34a46b6b08375be56fe116cf15782bc
freepats/synthesizer-percussion 39bbabce8e0e10aa259d5d94fca329f668733185
LIST
rm -rf "$work"
npx om samples build piano violins violas celli basses marimba glock vibes horn hornstac wurli pizz spic \
  kick snare clap hat ohat crash tom tamb shaker snap woodblock
