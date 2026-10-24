# Pulse 1.0.2 — Black Sea lighting and Prism startup

## Scope

Two direct requests: correct camera-dependent shimmering/faceted lighting in Black Sea, and try a different startup animation inspired by the supplied Mineradio video. Version remains **1.0.2**. Audius integration and the existing Windows installer design/logic are retained. Nothing is published to GitHub.

## Black Sea

- The deformed shared stone geometry had 27 duplicate-position UV seam pairs. Separate normal accumulation on those UV vertices produced a maximum normal jump of **61.6808 degrees** (26 pairs above five degrees).
- `graphics/ocean-rock-surface.mjs` now accumulates area-weighted normals by coincident position, while retaining separate texture UVs. All 27 seam pairs have identical normals after preparation; maximum seam jump is zero in the diagnostic fixture.
- Stable vertex tangents are computed once after deformation. The same 389 vertices / 720 triangles, UVs, indices, shapes, normal/color textures and stone instances are retained.
- Local specular antialiasing incorporates normal-map variance before Three.js physical lighting. Wetness, color, moonlight, audio-reactive lights and water remain in place; this is not a temporal blur or a flat/unlit replacement.
- The original `antialias:true` affected only the default framebuffer, while the postprocessing composer rendered geometry to non-multisampled targets. Black Sea now resolves up to four MSAA samples **before bloom**. Actual `MAX_SAMPLES` bounds the setting; FXAA remains afterward. Orbit retains its previous zero-sample composer path. Target changes are disposed/reallocated only on world switches, not each frame.
- No changes to the requested resolution, DPR, density, FPS limit, camera input, frame pacer, audio or quality selection. MSAA does add GPU work/memory; software rendering is not evidence of unchanged real Windows GPU performance.

## Prism startup

- A new large Pulse wordmark and restrained, curved prismatic glass replace the tiled logo, sparkles, pulse trace and bouncing letters. The video is a visual reference, not a reused video backdrop or imported Mineradio runtime.
- Original standalone procedural WebGL shader; no Three.js import, network request, audio source or player/library access. Single fullscreen triangle; stationary grain instead of flickering random noise.
- Short existing timing: 1800 ms minimum, 4500 ms safety cap, bounded exit. Automatic continuation remains; click, Enter, Space and Escape skip. Key events are consumed only while dismissing the splash.
- Existing `pulse.motion`, `pulse.splash` and same-session `pulse.splashShown` behavior remains. A tray-hidden startup waits for visibility. Reload/tray return does not replay startup. No user settings/library reset or migration.
- Reduced motion skips context creation; a live OS preference change removes the intro immediately. Forced colors and an already loaded GPU-off setting avoid the shader. Missing WebGL, shader failure or context loss use a CSS fallback; the app is not blocked.
- Resize changes canvas dimensions only when necessary. Pixel budget applies only to this new decorative startup layer (DPR up to 1.5, approximately two million pixels), not to music visualizers or their quality settings.
- All RAFs, context/program/buffer resources, pointer/resize/visibility/keyboard/load/language listeners and startup timers are released on dismissal. Hidden startup art does not spin a frame loop.
- Caption strings are present in RU/EN/JA/UK and follow the existing `pulse-language` event. No account credentials, locale preferences or music metadata are changed.

## Reproduce

From the repository root:

```sh
npm ci
npm run build:graphics
npm test
CHROMIUM_PATH=/usr/local/bin/chromium node app/tests/ocean-lighting-ui.cjs
CHROMIUM_PATH=/usr/local/bin/chromium node app/tests/prism-splash-ui.cjs
CHROMIUM_PATH=/usr/local/bin/chromium node app/tests/motion-splash.cjs
npm run test:final-effects
CHROMIUM_PATH=/usr/local/bin/chromium npm run test:final-ui
CHROMIUM_PATH=/usr/local/bin/chromium npm --prefix app run test:widget-clicks
CHROMIUM_PATH=/usr/local/bin/chromium npm --prefix app run test:file-video
```

The Black Sea WebGL test freezes audio/tint/water time, sweeps the camera, then requires a byte-identical return to the original frame. It covers 796×674, 1366×768, 390×844, all quality paths, repeated ocean/orbit switches and full texture cleanup. It does not assert that a physically view-dependent reflection should remain completely motionless.

The Prism browser test covers RU/EN/JA/UK, 1366/390 widths, keyboard/click skip, reload skip, reduced motion, forced colors, no-WebGL fallback, context loss, context release and no remaining startup RAF callbacks. The existing full-application startup test also remains applicable.

## Release limitations

Validation uses Linux Chromium/SwiftShader and Linux cross-packaging for Windows x64. This does not verify actual Windows launch/install/update, driver-specific MSAA behavior, native hit testing, SMTC, hardware FPS or subjective appearance on the user's machine. Final Windows acceptance: move the camera continuously through the supplied scene, verify the light seam no longer crawls, check the new startup once and with startup/motion disabled, and test updating a running older Pulse. The executables are unsigned. macOS remains a future plan, not a deliverable of this change.
