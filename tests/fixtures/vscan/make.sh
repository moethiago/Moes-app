#!/bin/bash
# Builds the e2e videos from the real عذق الجزيرة receipt. Needs: node + playwright, python3 + numpy + Pillow, ffmpeg,
# and `npm i @fontsource/noto-naskh-arabic` (Arabic font for the item names) next to render.mjs.
set -e; D=$(cd "$(dirname "$0")" && pwd); OUT=${FX:-/tmp/fx-vscan}; mkdir -p "$OUT"; cd "$D"
node render.mjs A "$OUT/receipt_A.png"
python3 film.py "$OUT/receipt_A.png" "$OUT/vscan_ok.webm"   10 720 1.3 1.5 11 0.5   # normal pan, slight shake
python3 film.py "$OUT/receipt_A.png" "$OUT/vscan_fast.webm" 4  720 2.2 2.5 12 0     # rushed, blurry, tilted
