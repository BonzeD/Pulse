# Pulse 1.0.1 — editor icons, explicit silence, instrumental filtering

## Changes
- Editor action buttons use official Lucide icons, bundled locally with the upstream license and pinned provenance in `app/renderer/lyric-studio-icons/`. Lyric words and line selectors remain readable text. All action buttons have localized names/tooltips and 44×44 targets. Play/pause follows actual transport state.
- Done (checkmark) returns to the corrector; the diskette applies the lyrics. Draft preservation remains separate from applying.
- Native Electron titlebar drag rectangles can intercept overlay clicks regardless of z-index. While the editor is open, the underlying titlebar and editor subtree explicitly use no-drag. SVG descendants do not intercept pointer events. The rule disappears when the editor closes. Native Windows hit-testing remains a Windows acceptance check, not something established by Chromium tests.
- Word timing action tooltip: set start to playhead, then select next word (T). It preserves the existing shift of subsequent words and automatic selection.
- Ellipsis action inserts an explicit silent marker at the playhead. Start is editable; the silence lasts to the next row, or song end for a final marker. It survives draft/save/reopen/raw-LRC edits and undo. The portable format is an empty timestamped LRC line, e.g. `[00:06.00]`, not the literal lyric `...`.
- Existing lyric renderer now honors explicitly marked pauses shorter than four seconds and trailing pauses. The thresholds for automatically inferred pauses remain unchanged. Exact inverse of this scoped app.js change is recorded in `tests/lyric-silence-approved.json`; older baseline hashes are not rewritten.
- Without words no longer trusts the search provenance `_inst` or broad genre/artist words (lo-fi, piano, ambient, soundtrack etc.). It requires explicit instrumental recording metadata/title, rejects known lyrics and explicit vocal variants, applies to offline and seeded waves, and does not prepend an incompatible seed.
- Filter rebuild invalidates pending starts/refills. Unknown recordings are excluded instead of silently relaxing the filter. Fewer recommendations are preferable to knowingly incompatible tracks. This is conservative metadata filtering, not audio vocal detection: incorrect upstream instrumental labels can still be incorrect.
- The current track still finishes after a wave-setting change, as the existing UI states; subsequent queue is rebuilt.

## Verification
- `npm test`: original suite plus explicit-silence and instrumental-filter cases; installer artwork test runs after build.
- `npm run test:lyric-studio`: actual pointer clicks at five positions of Save with independently edited values; icon/name/tooltip/target/no-drag assertions; real .5× HTML audio and nonzero analyser; rate restoration; drag/trim; undo/redo; raw errors; localized UI; desktop/mobile; explicit one-second gap rendered in real lyric state and retained on save/reopen.
- Native Windows installation, Windows drag-region handling, actual accounts/catalog labels and hardware FPS require Windows/real-service testing. No signing certificate is configured. Nothing published.

Version stays 1.0.1. Existing visual-performance fixes, audio engines, user settings and installer design are not reduced/reworked for these changes.
