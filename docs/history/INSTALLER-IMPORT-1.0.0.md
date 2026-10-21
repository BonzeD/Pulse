# Pulse 1.0.0 — installer imported from the supplied archive

Only the installer was imported from `Pulse-1.0.0-source(2).zip` (archive SHA-256 `15d612208006bfabc8819a79ec49577b9794e7d12c7ec359bf9982490542255e`). The current application updates are kept; version remains 1.0.0.

## Imported
- `build/installer.nsi`: byte-identical to the supplied archive (SHA-256 `e35330644c1e6870cc06862510a1d07ea7bedd07cab849f74bcc931c68ec2aaa`).
- All 1,024 files in `build/installer-ui/`, including the original Russian design, animation frames, five DPI sets and generation sources.
- `build/make-setup.sh`, with only tool discovery adapted to accept an explicit `MAKENSIS` path.

## Kept
- All current renderer/application improvements, including Immersion inside Text Only, Orbital station/Black Sea, pointer interactions and responsive transport.
- Current path normalization/validation and the package-owned uninstall manifest regenerated from the current x64 payload.
- Current application and media bridge. No older application code was copied from the archive. After the subsequent widget click fix, app.asar and portable are rebuilt with that fix; see `WIDGET-CLICK-FIX-1.0.0.md`.

The source installer's behavior is also restored: it closes Pulse before replacing files and has the original optional data-removal controls. Check those options before uninstalling; do not assume the previous installer’s always-preserve-data behavior.

The NSIS/graphics sources are kept intact, not redesigned. Windows runtime installation, event handling, DPI and accessibility require native Windows verification. Builds are unsigned.
