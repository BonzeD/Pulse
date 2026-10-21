#!/bin/sh
# 1.0.0: .NET 8 SDK can cross-publish this WinRT helper from Linux.
set -eu
cd "$(dirname "$0")/.."
DOTNET="${DOTNET:-dotnet}"
"$DOTNET" publish native/media-bridge/PulseMediaBridge.csproj -c Release -r win-x64 --self-contained true -o resources/media-bridge
# Debug symbols stay in source/build logs, not the downloadable application.
rm -f resources/media-bridge/*.pdb
# Ship applicable runtime/projection notices with the helper.
CACHE="${NUGET_PACKAGES:-$HOME/.nuget/packages}"
for package in microsoft.netcore.app.runtime.win-x64 microsoft.windows.sdk.net.ref microsoft.windows.cswinrt; do
  find "$CACHE/$package" -maxdepth 3 -type f \( -iname '*license*' -o -iname '*notice*' \) 2>/dev/null | while IFS= read -r file; do
    cp "$file" "resources/media-bridge/$package-$(basename "$file").txt"
  done
done
cp native/media-bridge/licenses/*.txt resources/media-bridge/
