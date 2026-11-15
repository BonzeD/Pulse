# Cosmos Atlas — Pulse 1.0.3

This supersedes the old artist-journey Atlas design. The unchanged audio code retains the EmbeddedFirst rollback. A locally stored, manually authored map starts empty. Saved playlists and selected library songs become stars; an existing playlist star follows the library record while available and retains a fallback snapshot. One star may be a member of one named constellation. A newly created group is connected by a chain. Edge and member removals are rejected if they would disconnect remaining members. Positions, connections, names and membership are stored in `lib.atlasCosmos`; removing an Atlas star or constellation does not remove the underlying library content.

The Atlas delegates playback to `playList` with a source marker. Actual playing state illuminates the source star red and pulses stars in its group blue. Pulsation is CSS visual motion, not beat detection. Selecting a star animates a camera transition, displacement wave and gentle movement of other constellations. Reduced-motion and app no-animation settings disable motion. Map interaction works with pointers, Shift-drag for groups and keyboard arrow keys. The track picker is bounded to 1,000 records.

Sidebar lyric drum wheel motion is eased, while dragging and reduced motion remain direct. This does not change the audio engine. Prior Mineradio fixes remain; this does not claim full upstream parity.

Automated checks use a mocked YouTube API and synthetic library and media. They are not a native Windows installation, audio output or live-service test. Windows binaries are unsigned.
