# Direct-stream regression correction — Pulse 1.0.3

## User report and confirmed regression

The user reported that normal audio no longer played after the audio audit, while embedded YouTube started immediately. The prior audit’s localhost WAV tests did not validate playable YouTube URLs. The optimization incorrectly chose the first API response containing an audio URL, then aborted the other candidates. A valid-looking URL can return HTTP 403. Proxy retries could consume the first two denied clients without ever reaching a playable third client.

A negative-control test using the exact delivered source reproduces that mechanism: first and second API clients return URLs whose CDN denies playback; the third would work. The delivered proxy returns 502 and never requests the third audio. This establishes a code regression, but is not a capture of the user’s actual network responses.

## Correction

- Each staggered candidate now completes both player metadata AND a bounded real audio-byte request before it can win. API URL presence alone is not success. No forced iframe-only workaround.
- The probe requests bytes=0-0 using the same User-Agent as streaming, accepts 200/206 with audio/video/octet-stream MIME type and requires nonempty body data. Rejects HTML and empty responses, cancels the body and honors cancellation/6-second timeout.
- Parallel/staggered behavior remains: a stalled media probe does not serialize other candidates. Losing requests are canceled only after a playable winner is established.
- Discard old persisted URL entries without `verified:2`; save the verification marker with new entries. This refreshes only stream links, not libraries, downloads, accounts or custom lyrics.
- Validate yt-dlp backup URLs before reporting resolution success. Clear an all-clients-rejected set so it cannot suppress every client forever.
- Original format selection, audio quality, graph, EQ, lyrics hotfix, transport pause/seek/race fixes and custom installer design remain unchanged. Version 1.0.3, no GitHub publication.

## Tests

- 8 direct-stream tests pass: exact-delivered negative control; healthy third candidate and actual HTTP WAV bytes; 200-HTML and empty body rejection; all-denied failure/no cache; slow probe hedging/cancellation; old-cache refresh; post-probe link rejection recovery; exact inverse preservation.
- Direct-stream Chromium integration passes: real HTTP fixture player API -> real CDN responses (two 403, third valid) -> actual offline.proxyStream -> actual Chromium audio decoder and AudioContext/analyser, then pause/seek. No iframe and no interception/fulfillment of the media route.
- Prior 23 audio-audit tests retain their explicit historical backend contract; current backend behavior is covered by the new direct HTTP tests. Renderer intent/seeking/DJ tests remain current.
- Final root `npm test`: **470 passed, 0 failed, 0 skipped**, including generated installer graphics at all five DPI scales. Structure check passes with 615 original paths retained.
- Existing audio-engine full-renderer, lyrics-provider and file-video integrations pass. Audio-signal integration initially failed its fixed 650ms stale-tap timing assertion during parallel browser tests/packing load; unchanged isolated rerun passed (real local/iframe sine, analyser/bass/Mineradio). No assertion was relaxed and no runtime audio-tap code was changed in this fix.
- All 14 previous approved manifests and original installer source/design matched the delivered source byte-for-byte. New direct-stream exact inverse leaves previous hashes intact.
- Unpacked app.asar matches 241 first-party working-source files; the package remains 1.0.3. Portable/setup extraction and PE version resources are verified after packaging below.

## Live-service verification limit

Attempted the real YouTube player API using public video jNQXAC9IVRw with the app’s current clients. All three guest clients, including fresh-guest retries, returned HTTP 200 with playability LOGIN_REQUIRED, asking to sign in to confirm the requester is not a bot; no formats/stream URL were supplied. No authenticated user account was available. Therefore no live successful direct YouTube playback, Windows-native execution or user-network timing is claimed. Embedded playback can differ from guest API access. The user must verify the resulting fix on their network; if it still fails, collect the failing track and actual error/status rather than blindly changing transports again.

## Package verification

Portable and custom NSIS setup extracted successfully. Both contain the exact new app.asar and unchanged Windows media bridge / embedded Python base_library.zip from win-unpacked. Pulse.exe and Setup FileVersion/ProductVersion are 1.0.3. Original installer logic and artwork source unchanged. Binaries are not claimed to have been launched on Windows here.

- `Pulse-Setup-1.0.3-DirectFix.exe` — 242005466 bytes — SHA-256 `bc8091d609091a7c897e8b8556fb8075a9eead0c38bafd03834ac3496de9e644`
- `Pulse-1.0.3-DirectFix-portable.exe` — 223679999 bytes — SHA-256 `5b28ec2c9d772e8007306d9d93ccfc09f249e0b17bf1e11a116b701855c954ca`
