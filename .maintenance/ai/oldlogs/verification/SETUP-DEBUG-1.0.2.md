# First-run setup, debug menu and cover ink — 1.0.2

## Behavior

- New local profiles see the five-step “Let’s make Pulse yours” wizard after the normal startup splash: language (RU/EN/JA/UK), catalog and optional sign-in, graphics, everyday preferences, then review.
- Existing profiles are not treated as first-run profiles. A stored `onboarding: {version: 1, status: …}` marker distinguishes pending/completed/skipped setup; interrupted pending setup is offered again. The marker belongs to the local Pulse profile, not a remote service account.
- Settings → General → Run setup again reopens the wizard with current values. It does not reset the library, accounts, playlists, media, renderer quality or preferences. “Current settings” preserves mixed/custom graphics settings. Presets change graphics only when explicitly selected. Language preview does not save the choice; later/skip restores the stored language.
- Draft preferences apply only on Finish. The allow-list is defined in `renderer/setup-model.js`. The existing synchronous durable library flush must return true before the wizard closes. Failure rolls back the exact preference changes and marker, and leaves an error message/retry. A failed initial library read is not considered a new profile and does not trigger the initial preset save.
- Sign-in uses the existing provider/browser dialogs, not new password forms. Audius is explicitly public/no-sign-in. Login is optional. Completed sign-ins are real external actions and are not rolled back by skipping the preference wizard. No success is invented if a provider is unavailable.

## Debug menu

- Five **right** clicks on Pulse, within 1600 ms and no inter-click gap above 450 ms, open Debug. Ordinary left navigation and five-left-click Prism remain separate.
- Actions launch setup, Prism, home/library/downloads, player/lyrics/Immersion/visual/cover, transport, settings sections, fullscreen, widget and a test notification through the existing functions/preload. Track-dependent actions are disabled without a track. Actions affect the real player, as stated in the interface.
- Checks cover settings structure, queue bounds, UI module/bridge availability, existing WebGL probe, current shared audio spectrum and read-only profile access. Silence/missing capture is “Not checked”, not fake success. Probing capability or sending an IPC command is not proof of a working native window, service or GPU driver.
- Status refreshes explicitly; there is no diagnostics polling timer or background renderer. Copy report exports only an allow-list of version, language, rendering preferences, module flags, counters/booleans and check IDs/states. No track metadata, account names, files, tokens, cookies, passwords, raw remote errors or full profile serialization. No eval console, reset, logout, deletion or automatic account/network tests.
- Modal focus is contained/restored and prior inert flags restored exactly. Native login dialogs temporarily regain interactivity while the wizard is inert. Debug tabs support keyboard arrows/Home/End. Layouts are checked at 1366 and 390 widths, reduced motion and forced colors.

## Prism changes

- The visible top-right Return button and bottom Escape hint were removed, as marked in the supplied screenshot. Escape and Enter still close; double-click/double-tap also exits. An invisible accessible close button remains for assistive technology.
- Pulse text flows slowly through the current cover palette. Raw decoded cover colors are passed from the existing `applyPalette` before the user's fixed-accent override. No new image loading loop, WebAudio context or per-frame image decode. Palette variables update once per completed cover extraction. Dark tones are lightened for a legible large wordmark; unavailable art uses the pastel default.
- The CSS gradient is scoped to the text, paused when hidden, static for reduced motion/disabled animation, and replaced by system text in forced colors. Existing Prism draw caps, main-visual quality/FPS and all prior effects are unchanged.
- Brand letters are marked `data-i18n-skip`: in particular, the standalone letter `s` must not be interpreted by the general translator as the seconds abbreviation and changed into Cyrillic `с`.

## Verification

- `npm test` includes six new pure-model/integration-boundary tests plus all historical regression tests (426 checks).
- `CHROMIUM_PATH=/usr/local/bin/chromium npm --prefix app run test:setup-debug`: full renderer with local-only explicit native bridge fixture, upgrade/fresh/restart/read-failure, gesture separation, durable failure rollback, sign-in dialog cancel/resume, no Audius fake login, data preservation, Settings rerun, languages/skip, sanitized copy, diagnostics, hidden chrome, cover ink and exit, desktop/narrow/reduced/forced-color layouts.
- `npm --prefix app run test:prism`: startup, gesture, shared FFT, teardown, accessibility, hidden-window suspension and generated WAV through the actual app audio graph. Existing tests now use Enter rather than the removed visible Return control. Tests require the exact Latin word “Pulse”.
- Historical expected reports/hashes were not rebased. `setup-debug-approved.json` + `setup-debug-original.cjs` invert only these reviewed runtime deltas before earlier inverse layers. New tests run against current code, without inversion. The prior Prism hash audit first strips these separate changes before auditing its original hash.
- Also run final UI/effects, widget clicks and local file/video regression suites. Verify the asar in both EXEs equals the final unpacked app, and verify the source ZIP manifest.

## Limitations

Linux Chromium/SwiftShader is not native Windows runtime testing. Real provider sign-in, Windows install/update/uninstall, fullscreen/widget/OS hit testing and hardware GPU/frame timing still require checks on Windows. Debug self-check is deliberately not an end-to-end test of every external/native feature. No dependencies, installer design/scenario, version bump or GitHub publication were requested or added. Executables remain unsigned; version stays **1.0.2**.

## Documentation correction

The README's Spicy conditions link incorrectly pointed to `docs/history/SPICY-PROJECT-1.0.1.md`. It now points to the existing historical `SPICY-PROJECT-1.0.0.md`; the historical file itself was not renamed or rewritten. All local README links were checked for existing targets. This archive does not push changes to GitHub.
