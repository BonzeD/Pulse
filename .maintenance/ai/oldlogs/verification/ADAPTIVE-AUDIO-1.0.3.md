# Pulse 1.0.3 — honest sign-in and bounded adaptive next-track preparation

## User evidence

The user saw a saved account identity while playlists were unauthenticated. Re-signing in restored working backup audio. In the supplied subsequent capture, both selected tracks eventually reach `playing` through the audio engine. Anonymous direct-client URLs still return 403, while the backup URL passes a normal-range probe and real upstream requests return 206. Most startup time precedes stream acquisition, not decoding. This is not evidence that every LOGIN_REQUIRED player-client response means the user's account is signed out.

## Authentication changes

- Cached identity is explicitly `verified:false`, with `unverified` for a failed/unknown check or `reauth` for explicit authorization rejection. Strict validation still returns null unless a recognized active-account header is present. A name found only in a remembered-account/switcher response does not verify a session.
- Renderer keeps saved identity separate from active `account`, does not show its avatar/active dot, pull likes, snapshot or sync it as a verified session. Retry and sign-in actions are available. Playlist HTTP 401/403 or explicit loggedOut responses downgrade the status; an empty playlist collection alone does not.
- Refresh sequencing rejects late responses after newer refreshes/logout. Offline status is unverified, not freshly confirmed. Previously rendered personalized greeting is refreshed on loss of confirmation. Cookies, saved account snapshots and local library are not erased by transient failures.
- New labels are localized in Russian, English, Japanese and Ukrainian. Compact warning control fits 390px alongside native window controls and exposes its status via menu, title and accessible label.

## Audio changes and resource bounds

- A client is temporarily avoided only after denial evidence from at least two distinct tracks within a two-minute window; repeated attempts on one track do not count twice. Successful probes clear its evidence. Cooldown expires after two minutes, permitting another trial. No permanent block or persisted per-track history.
- Account-session revision resets learned state and old stream URL cache on sign-in/switch/logout. In-flight stale resolutions are prevented from repopulating that cache.
- Ordinary hover prefetch remains direct-only. The explicitly marked next queued track may prepare a backup only when all direct clients are temporarily blocked AND a backup has recently passed a normal media probe or served real audio.
- Next-track preparation is debounced 1.2 seconds, limited to one target and one speculative child at a time, and coalesced with foreground requests for the same track. A different foreground selection aborts its speculative child and takes priority. Replacing the target, manual pause, session reset and app quit cancel pending/active speculative preparation. Existing independent foreground deck requests are not globally serialized.
- Preparation obtains/caches only a validated URL and first-chunk probe, not whole-track audio. It does not scan the queue/library or maintain an idle background process. Child timeout remains 30 seconds. Offline downloads, embedded engine selection, quality selection, native media bridge and decoder are unchanged.
- When a direct-only next-track probe supplies the second distinct-track failure, that specific next track can be scheduled for bounded backup preparation after the policy becomes eligible.

## Validation

See adaptive-audio-1.0.3/ for final unit, UI, negative-control, protected-file and package checks. Negative controls use the exact previously delivered SessionAudioFix source through a new inverse layer, without rewriting historical approval manifests. Current tests cover distinct-track evidence, cooldown/reset, hover prohibition, warm eligibility, queued/live cancellation, same-track promotion/coalescing, a second foreground deck leaving already-promoted work intact, session cache reset, unverified identity, guest-name rejection, playlist authorization failures, UI refresh races and all four locales at 390px.

Actual WAV bytes are served by local HTTP player/CDN fixtures through the real proxy into Chromium's decoder, AudioContext and analyser. A prepared next track starts without another player API lookup or backup subprocess, and pause/seek are verified. Existing full-renderer audio/background suites are also run.

No real Google credentials, Windows reboot, native Windows subprocess termination, live YouTube acceptance or real-world latency/CPU/RAM benchmark is available on this Linux host. Cooldown/prefetch can avoid repeated work and move necessary resolution earlier; the first uncached song or a rapid manual selection may still need the backup loader and remain slow. No guaranteed instant playback. Version remains 1.0.3; original installer and user-data identity retained. No publishing to GitHub.

## Final validation results

- Full unit/regression suite: 521 passed, zero failed, zero skipped. Includes 21 adaptive-audio cases and the promoted-foreground/multiple-deck cancellation regression.
- Real-renderer account UI, prepared-stream decoding, existing session-stream, audio-engine and background UI suites passed with local/synthetic services.
- Final unpacked ASAR: 246 first-party files match the working source, no missing required modules. Native media bridge is byte-identical to the previous delivery. Windows PE application version remains 1.0.3.
- Completed original custom Setup and portable independently extracted: app.asar, native media bridge and embedded Python base_library.zip are byte-identical in both packages and win-unpacked. All three Windows PE version resources are 1.0.3. See setup-payload.json for SHA-256 values.
- All 17 historical approval manifests and five protected installer/design inputs remain unchanged (22 files checked).
