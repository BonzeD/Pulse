# Pulse 1.0.0 — file video player and rounded artwork lighting

## Player
- Catalog-owned local and downloaded media now uses Pulse's own HTML video surface, not a YouTube iframe. Both playback decks are HTMLMediaElements (`video`), feeding the existing EQ/analyser and transport. Sound and picture share one clock; no parallel audio player is created.
- Play/pause on the picture or overlay button; existing seek, time, volume, repeat, queue, widget and media-session controls remain shared. Overlay fullscreen and double-click request Pulse fullscreen.
- Video mode retains the playback position and pause state when switching to/from Song. Unknown or failed old requests cannot replace a newer selection.
- Actual streams are probed with bundled FFprobe. Embedded album art is not counted as video. Silent video imports are supported.
- If video decoding fails, bundled FFmpeg creates a cached H.264/AAC MP4 copy (up to 1920×1080, preserving aspect ratio). Originals are never modified. One low-thread conversion runs at a time without holding the catalog mutation queue. Temporary files are removed on failure. Compatibility conversion is lossy; direct playback does not transcode.
- Local serving uses the existing loopback origin, catalog IDs and path validation. Range, HEAD and invalid-range handling allow seeking without loading the entire video into memory. No arbitrary filesystem-path IPC or remote-source URL is accepted.
- Existing downloaded audio-only tracks cannot display video that was never downloaded. The player explicitly says the file has no video track. Track menu → Download video for offline playback starts a separate video-capable yt-dlp request, preferring H.264/AAC MP4 up to 1080p.
- MP4/WebM plus MOV/M4V/MKV may contain different codecs; a file extension is not a codec guarantee. Corrupt, DRM-protected, or unsupported streams can still fail with a file-specific error, not an embed restriction.

## Rounded artwork light
In Song mode, the pointer light now belongs to `#artWrap > .art`, whose real radius and transform match the displayed artwork, rather than the square `#artWrap` wrapper. The light is clipped by the rounded surface and is disabled over video.

## Validation
- 190 unit/regression tests, including real FFmpeg import, silent video, attached-picture exclusion, downloaded aliases, partial reads, conversion cache, source immutability and non-blocking/error cleanup cases.
- Full app in Chromium with real H.264/AAC media: picture dimensions, single playing deck, nonzero analyser samples, pause/resume, seek, shared volume, fullscreen command, mode-switch clock preservation, offline downloaded video, audio-only status, decode-error conversion, stale loads and loading/error UI.
- Desktop 1366×768 and narrow 390×844 render inspection; rounded Song-mode light inspected.
- 66 widget click/command checks, plus existing square/round catalog hover checks.
- Windows native playback, OS fullscreen and native widget hit testing were not executed in this Linux environment. The live YouTube download path was not tested against an authenticated account. Windows binaries remain unsigned.

## Preserved
Version remains **1.0.0**. Previous widget, Immersion/Text Only, cursor, transport and other app fixes remain. Original imported installer script and graphics are unchanged (NSIS SHA-256 `e35330644c1e6870cc06862510a1d07ea7bedd07cab849f74bcc931c68ec2aaa`).

## References consulted
- Electron protocol documentation: streaming media and local-file handling — https://www.electronjs.org/docs/latest/api/protocol . The project already has an origin-restricted loopback server, so it is retained instead of adding a second protocol.
- MDN video-codec guide: container versus codec, broadly supported H.264/AAC in MP4 — https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs .
