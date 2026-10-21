#!/bin/sh
# 1.0.0: сборка установщика без wine, только с актуальной графикой версии.
set -eu
cd "$(dirname "$0")"
MAKENSIS=${MAKENSIS:-$(find "$HOME/.cache/electron-builder" -type f -path '*/linux/makensis' -print 2>/dev/null | head -1)}
if [ -z "$MAKENSIS" ]; then echo 'NSIS не найден: сначала соберите portable через electron-builder.' >&2; exit 1; fi
N=$(dirname "$(dirname "$MAKENSIS")")
V=$(node -p "require('../package.json').version")
UI=installer-ui
# Refresh graphics when either version, installed size or design changes.
SZ=$(du -sm ../dist/win-unpacked | awk '{print int(($1+5)/10)*10}')
KEY="$V:$SZ:$(sha256sum "$UI/design.html" "$UI/gen.js" "$UI/crop.py" | sha256sum | cut -d' ' -f1)"
if [ "$(cat "$UI/out/.build-key" 2>/dev/null || true)" != "$KEY" ]; then
  ( cd "$UI" && node gen.js "$V" "${SZ:-420}" && python3 crop.py && printf '%s\n' "$V" > out/.version && printf '%s\n' "$KEY" > out/.build-key && rm -rf out/raw )
fi
node uninstall-manifest.js
NSISDIR="$N" "$MAKENSIS" -V2 -DVERSION="$V" installer.nsi
