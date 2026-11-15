# Pulse 1.0.3 — saved session and blocked-audio recovery

## Reported behavior and evidence

The user reports apparent Google sign-out after Windows restart; clicking sign-in reconnects without completing a browser flow. The supplied anonymized capture shows a different, independently observable issue: T4 takes about 8.32 seconds from load to playing. Client 1 and client 2 return 206 to the previous one-byte probes, then 403 to real bounded-range stream requests. After a 502 and another renderer stream request, the backup resolver takes 6299.42 ms and playback succeeds. Anonymous player API LOGIN_REQUIRED responses do not prove the user's account is signed out. The precise reason the remote CDN rejects the larger requests is not established.

## Changes

- Restore only the active existing local encrypted account snapshot before the main window initializes. Preserve currently populated auth cookies and original expiration dates; do not restore expired credentials or inactive accounts. No browser scanning, browser launch, profile migration, or automatic login request.
- Snapshot a successful verified login immediately and flush Chromium's cookie store. Quit also requests a best-effort flush, but persistence does not depend on an async shutdown handler completing.
- A temporary/unrecognized account-menu response no longer deletes cookies. Strict checks still require a recognized account response; explicit HTTP 401/403 does not claim a verified identity. Support account names supplied as runs or simpleText. Account-menu requests have a bounded timeout.
- Explicit logout clears the saved active pointer; epoch checks stop delayed account responses from reactivating a signed-out account. A local restore already in progress is awaited before deliberate session clearing. Preserve encrypted blobs when decryption is unavailable; listing/filtering saved accounts no longer rewrites them.
- Media probes use the same bounded range and User-Agent as startup playback, consume the first chunk, then cancel. One-byte-only validation marker 2 is replaced by marker 3: only old stream URL caches are invalidated, not credentials or library data.
- After two actual direct-link rejections, attempt the existing backup resolver inside the same HTTP request. At most three proxy attempts; no unbounded retries. Per-track rejection state has a 15-minute TTL and a 200-track cap. Low-priority prefetch still never starts the backup process. Untried healthy direct candidates remain eligible when probes fail.
- Stream 4xx/5xx completion is logged as error, not success. HTTP-200 player responses with non-OK playability are logged as denied. Recorder privacy/size/time bounds unchanged.

## Scope protection

No renderer engine, iframe routing, audio context, bitrate/quality selection, seek/pause behavior, library, lyrics, account-encryption format or product identity change. Version remains 1.0.3. Original installer design and native media bridge retained. No GitHub publish. Historical approval manifests are not re-hashed; a new exact inverse layer reconstructs the delivered AudioBackground source.

## Validation and limitations

Final full suite: **500 passed, 0 failed, 0 skipped** after installer artwork generation. The version suite independently passes all three checks, including all-DPI installer artwork and parsing every first-party JavaScript file. See session-audio-1.0.3/ for test output and package checks. Tests use temporary synthetic credentials, mock Electron cookie/safeStorage APIs and local HTTP CDN/player fixtures. Positive and negative controls cover cold session-cookie loss, preservation of rotated cookies, expiry, explicit logout, unexpected account responses, delayed-response races, immediate verified-login snapshots, one-byte-only CDN responses, and two real upstream rejections. Chromium decodes real WAV bytes through the actual proxy and an AudioContext/analyser, including backup recovery, pause and seek. Existing full-renderer audio and background suites are also run.

No real Google credentials were requested or used. Windows reboot, native DPAPI behavior, live YouTube acceptance and real-world start latency cannot be verified on this Linux machine. Existing revoked/deleted credentials cannot be recreated: a user may need to sign in once before testing restart persistence. The backup resolver may remain slow due to YouTube/network behavior; no instant-play guarantee.

## Delivered package checks

Both Setup and portable contain byte-identical app.asar, the unchanged native media bridge, and Python standard library compared with win-unpacked. All three PE version resources report 1.0.3. The ASAR check compares all 245 first-party shipped files with the current source (no differences/missing required modules). Original installer source/design/hooks and all 16 historical approval manifests are byte-identical to the previous delivered source archive. Source bundle has a per-file SHA-256 manifest and full archive read-back verification.
