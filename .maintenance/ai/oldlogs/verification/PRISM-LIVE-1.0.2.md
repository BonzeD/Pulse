# Prism Live — 1.0.2 rebuild

## Requested behavior

- Five quick activations of the existing Pulse logo/name open Prism as a persistent, full-window music lens. The five activations fit within 1600 ms, with no gap above 450 ms. Ordinary activations still navigate home. The fifth activation is consumed before navigation. Enter/Space also activate the focusable logo.
- No automatic dismissal and no extra navigation/settings entry. Escape or the Return button dismiss the lens. The original startup retains its 1800 ms minimum / 4500 ms safety cap and skip controls. Disabling startup does not disable explicitly opening the easter egg.
- Bass gently expands a chromatic caustic lens; mids deform the glass vanes; high-frequency bands illuminate spectral threads. Nine independent spectral envelopes drive the vanes. Waveform RMS preserves loud/quiet dynamics when byte FFT saturates. Attack/release smoothing is time-based; only real low-frequency attacks create an onset envelope. Silence, pause and missing capture do not synthesize a beat.
- The same delayed `readSpectrum` source as the other visuals is read directly. There is no additional player, AudioContext, microphone, request, decoder, download or sound source. Playback position, transport, volume, settings and library are not rewritten. Space controls the existing transport while the lens is open.

## Optimization

- Reused the original one-triangle WebGL field and palette; no Three.js, framebuffer chain, bloom pass, texture uploads or network art.
- Moved lane/time-dependent trigonometry and tint mixing from per-fragment loops into reusable CPU uniform arrays. Shared per-pixel sine/cosine terms across all nine vanes. Reject distant lanes before expensive optics. Replaced trigonometric noise with stationary interleaved-gradient dithering. Startup and the easter egg share the optimized renderer.
- No canvas dimension writes while dimensions are unchanged. Keep the prior decorative layer limits: DPR up to 1.5, about two million pixels. Main music-visualizer resolution, FPS, quality and density are not changed.
- Decorative animation is bounded to 60 rendered frames/s, or the existing lower FPS/eco limit. Cadence phase is retained; animation deltas use actual elapsed draw time. This is a limit on Prism only, not the app's musical visualizers.
- Document visibility and the explicit Electron hide/minimize signal stop the art RAF immediately. No polling timer is added for Prism.
- The opaque lens suspends hidden ordinary visual draws, native lyrics-stage animation, Immersion rendering and MineRadio rendering. Sound, playback and DJ timing keep running. Existing scene selection and settings are not changed. On exit, the normal stage can resume.
- Dismissal releases the shader program/buffer/context, RAF, visibility/resize/pointer/media/language/key listeners and overlay DOM. Only the passive logo activation handlers remain. Rebuilds after accessibility changes use a fresh canvas rather than attempting to reuse a permanently released context.

## Accessibility and failure modes

- Semantic modal dialog, accessible Return button, visible keyboard focus, focus containment and restoration, and restoration of the exact prior `inert` values behind it. RU/EN/JA/UK labels. Small-window layout is checked at 390×844 as well as 1366×768.
- Reduced motion or disabled interface motion displays a static identity without creating a WebGL context. A live OS motion preference change tears down/rebuilds the renderer, without closing the explicit view. Forced colors use system foreground/background colors.
- Disabled GPU, missing WebGL, compile/link failure and context loss leave a closable CSS fallback, never stop playback and never start a retry loop. Context loss can be recovered by closing/reopening the lens.

## Tests

```sh
npm ci
npm test
npm run test:prism --prefix app
CHROMIUM_PATH=/usr/local/bin/chromium node app/tests/motion-splash.cjs
CHROMIUM_PATH=/usr/local/bin/chromium npm run test:final-ui
npm run test:final-effects
CHROMIUM_PATH=/usr/local/bin/chromium npm run test:widget-clicks
CHROMIUM_PATH=/usr/local/bin/chromium npm run test:file-video
```

- `prism-signal.cjs`: silence/no missing-signal beat, frequency separation, onset versus steady tones, 30/60/120 Hz smoothing, reused arrays, rate/invalid input handling, saturated FFT with real waveform dynamics, read-only audio integration, rendering suspension and exact inverse checks.
- `prism-live-ui.cjs`: actual five-click timing and ordinary clicks, no timer dismissal, signal-to-uniform response, shared Space, focus/inert restoration, narrow layout and four languages, native hidden-window suspension, unchanged framebuffer allocation, resource teardown, repeated open, reduced-motion restoration, forced colors, missing WebGL and context loss.
- `prism-integration-ui.cjs`: the actual application with a generated WAV routed through its existing media-element/WebAudio graph. Verifies that the overlay receives a real FFT, keeps the original audio element/context/analyser/settings/volume/track, handles real brand/keyboard activations and native window suspension, and leaves playback running after exit. No live account/service dependency is mocked as a successful service playback test.
- Previous startup, visual, widget, effects, local video and historical regression tests remain relevant. Historical expected hashes/reports are not rebased. `prism-live-approved.json` is a separate exact inverse of only these changes for older baseline comparisons. Tests of the new behavior run on the current code, without inversion.

## Release limitations

Linux Chromium/SwiftShader tests and Linux-to-Windows packaging do not verify native Windows installation/update, Windows GPU-driver behavior, system hit testing or actual hardware FPS. The executables are unsigned. Verify the five logo clicks, bass response, pause/seek/volume, minimize-to-tray, repeated open/close and Escape on the user's Windows machine. macOS is still a future plan. Version remains 1.0.2; do not publish to GitHub without a separate request.
