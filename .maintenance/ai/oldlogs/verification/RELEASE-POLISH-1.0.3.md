> Historical release-polish phase report. The subsequent lyric drum, Mineradio bridge and background recovery additions are documented in [DRUM-SCENE-BACKGROUND-1.0.3.md](DRUM-SCENE-BACKGROUND-1.0.3.md); its scope/build tag supersedes the earlier scope below.

# Pulse 1.0.3 — EmbeddedFirst release polish

## Scope and baseline

Starting point: the delivered `Pulse-1.0.3-EmbeddedFirst-source.zip`, not stable 1.0.2 or the earlier direct-first experiments. Author feedback confirmed a substantial improvement; one recording still failed. No attempt to automatically replace that recording, clear cookies, weaken media validation, change quality or bypass service restrictions was made. Version remains 1.0.3. No GitHub publication, installer, new dependencies or new music feature.

## Confirmed edge cases and fixes

A dedicated pre-fix test run executed seven new behavior scenarios against the delivered source and reproduced six failures. These were local deterministic fixtures, not allegations about every user session.

1. Repeated YouTube BUFFERING state events cleared/replaced the same 10-second timer, allowing a continuous stall to keep postponing fallback. The active stall deadline is now reused until playback resumes or the attempt ends.
2. A PAUSED event from the built-in player left that buffer timer alive. PAUSED/ENDED now clear it and the loading indicator. CUED only clears it when autoplay is not wanted; an intermediate CUED state cannot disable a requested start deadline.
3. A delayed PLAYING event after app pause was emitted into diagnostics before being rejected. Pause intent is now checked before logging accepted playback; the UI state is refreshed on rejection.
4. A failed direct resolver did not set the idle-error retry flag, making an explicit `E.play()` a no-op after total failure. Explicit Play now retries the same selection through its normal route; no automatic recording substitution.
5. Browser MediaSession and native command callbacks gated Pause on actual `playing`, so Pause while mapping/resolving could be ignored. Play also delegated to toggle while a load was pending. Shared explicit transport handlers now honor requested intent as well as observed state. Actual Windows SMTC execution remains untested here.

Application source changes are restricted to `renderer/app.js`; the diagnostic build label and test scripts were also updated. Electron is separately updated from 44.8.0 to pinned 44.10.1 (same major); app/package-lock.json is updated consistently. The initial npm audit identified GHSA-jr5w-w6x2-84p9, a high-severity certificate-trust advisory affecting the bundled runtime; this is not dismissed as harmless just because Electron is a devDependency. Final audit findings are recorded in the validation evidence. Do not force npm audit fix --force: its proposed builder downgrade is unrelated to the audio release and could break packaging. Native helper source, install/uninstall design, audio quality, DSP, graphics settings and user profile layout are unchanged.

## Documentation corrections

The existing directory is `.maintenance/ai/oldlogs/`; `.mainstance` was a spelling mismatch, not a second intended directory. The root AGENTS.md had deliberately been removed previously; it is not recreated.

The active `development/FOR AI.md` section now explicitly supersedes obsolete direct-first instructions. Older content remains intact. `Logs/1.0.3.md` is a readable English changelog, updated to remove obsolete prewarming claims. Prior technical audio reports were moved byte-for-byte from Logs into `verification/audio-history/`. Historical approved manifests/reports in the original archive are not rebased.

## Validation and artifacts

See `release-polish-checks/` for final checks and build evidence. Full root tests include repository layout/history checks. Dedicated current-code unit and full-renderer scenarios cover the changes; exact source inverses are used only for historical negative controls. The source archive retains its nested yt-dlp Python runtime ZIP, excludes node_modules/dist/native build intermediates and generates a fresh source manifest.

The Windows media bridge is cross-published from unchanged source using .NET SDK 8, not silently copied from a prior binary. Portable is built with electron-builder `--win portable --x64 --publish never`. Final app.asar/source, native resources and extracted portable payload must be compared before delivery.

Linux Chromium and cross-build/payload inspection do NOT prove native Windows behavior, live YouTube startup speed, installer behavior or universal track availability. One optional generated-installer-artwork test can remain skipped because no installer is produced.

## Security audit and environment limitations

Before the Electron update, npm audit reported 17 affected dependency entries (16 moderate, 1 high). After pinning Electron 44.10.1, it reports 16 moderate, 0 high, 0 critical and no Electron advisory. The remaining findings are in build/development dependency chains; they are not declared fixed. A broad forced downgrade/upgrade was not applied during an audio reliability release. The app version and both root/app lockfile release versions remain 1.0.3.

The local Chromium UI tests execute real application renderer code and synthetic service/IPC fixtures. A separate attempt to execute Linux Electron itself was blocked by missing `libgtk-3.so.0`; no native Electron GUI success is claimed. Windows payload inspection is independent of that missing Linux GUI library. On the target Windows computer, check SMTC/media keys while loading, pause/seek across fallback, rapid track switching, offline local MP4 playback, profile restoration and real embedded-service availability.
