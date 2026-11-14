#!/usr/bin/env bash
# Prints the code-signing identity to use: $POINTO_SIGN_ID if set, else this Mac's first
# "Developer ID Application" identity, else its first "Apple Development" one, else "-" (ad-hoc).
# A stable identity keeps macOS privacy grants (Screen Recording, Microphone) across rebuilds.
set -euo pipefail
if [[ -n "${POINTO_SIGN_ID:-}" ]]; then echo "${POINTO_SIGN_ID}"; exit 0; fi
ids="$(security find-identity -v -p codesigning 2>/dev/null || true)"
for kind in "Developer ID Application" "Apple Development"; do
  hash="$(printf '%s\n' "$ids" | awk -v k="$kind" 'index($0, "\"" k) {print $2; exit}')"
  if [[ -n "$hash" ]]; then echo "$hash"; exit 0; fi
done
echo "-"
