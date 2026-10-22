# Pulse 1.0.0 — visual frame pacing

## Changes

- Main visual loop and the direct coverfield/radial path now share the caller's requestAnimationFrame timestamp. Direct drawing and geometry reads happen before that loop's lyric/beat DOM writes, rather than in a second competing RAF callback.
- A phase-preserving deadline gate replaces `elapsed < period - 2 ms; last = now`. Fractional time is retained; missed frames are skipped without catch-up bursts. Unlimited still follows the display. User-selected FPS and quality values are not rewritten.
- The already empty, hidden Canvas 2D layer is not cleared every direct WebGL frame. Canvas/copy fallback resumes normal clearing and visibility. Trails, flash and mirror retain their existing compatibility paths.
- Unchanged backing-store dimensions are not reassigned by ResizeObserver. This prevents clearing/reallocating the canvas for redundant notifications.
- FFT logarithmic band boundaries are cached by sample rate and frequency-bin count. The spectrum values and smoothing are still calculated every rendered frame.
- Reduced-motion MediaQueryList is reused while reading its live `matches` value. Neon geometry writes into its existing typed buffer rather than creating one temporary array per bar/peak.
- Avoid an unused second artRect read in the direct path's service update.

## Scope preserved

Version remains 1.0.0. No settings migration, cap reduction, forced quality reduction, new GPU command-line switches, background worker, audio/playback changes or installer changes. Existing high-refresh lyric updates stay intact. Immersion, MineRadio and their renderers are not changed. README retains the author's latest edits.

## Verification

- `npm test`: 285 passed, 1 skipped (existing platform-dependent test); repository structure passes.
- `npm run test:final-ui`: passed, including actual shader compilation, direct/copy switches, narrow layouts and reduced motion in Linux Chromium/SwiftShader.
- `npm run test:final-effects`: 280 / 280 visible effect deltas, no unchanged cases.
- `npm --prefix app run test:visual-performance`: deterministic before/after Canvas pixel comparison, direct-path operation counts, mode-switch visibility and same-size resize preservation. All 28 retained Canvas presets matched pixel-for-pixel at deterministic timestamps. For each direct preset, a 24-frame run needed 1 Canvas clear instead of 24, and 1 MediaQueryList creation instead of 24. The detailed committed result is `docs/verification/visual-performance-results.json`; a fresh run writes `app/tests/artifacts/visual-performance.json`.
- New unit tests simulate 30/60/120/144 FPS targets on 60/120/144/165/240 Hz displays, timestamp jitter, visibility changes, cap changes and stalls. These are scheduler tests, not Windows FPS benchmarks.
- Historical hashes/references are retained. `visual-performance-approved.json` contains exact reversible performance-only diffs, applied before the existing baseline adapter. New behavior is checked without reversing those diffs.

## Windows acceptance check (still required)

1. Use the same track, visual, FX, window size, display refresh rate and power profile before/after. Keep the window focused and visible. Test both the problematic visual and a second style.
2. Keep the existing FPS/quality settings for the comparison. Test the selected cap and unlimited separately. Do not compare a 60 FPS cap to unlimited.
3. Enable the existing FPS overlay. Record both UI and VIZ readings and the render path, not just the first number. CPU submit time is not GPU execution time.
4. Warm up for 10 seconds, then observe for at least 60 seconds. Check resizing, minimise/restore, cover/video switches, and trails/mirror/flash.
5. For a conclusive result, capture renderer frame timings in DevTools Performance. Compare long frame intervals and missed display deadlines; average FPS alone can hide stutter.

This patch removes verified redundant operations and fixes scheduler drift. It does not prove that a particular Windows GPU can sustain 120 FPS. A 120 FPS cap on a 144 Hz display also cannot make every displayed frame interval identical: fixed-refresh presentation slots are discrete. No artificial FPS smoothing was added.

## Applying the source update

Close Pulse. Copy the contents of `Pulse-1.0.0` **over the existing repository**, replacing matching files. Do not delete the repository directory or its hidden `.git` directory. The archive contains sources, not a ready Windows EXE. Rebuild with the existing workflow or `npm ci` then `npm run dist` from the repository root. No release is published automatically.

## References

- https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
