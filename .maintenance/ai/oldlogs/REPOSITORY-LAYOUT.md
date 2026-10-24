# Current repository layout

- `app/`: application code, renderer, native helpers, dependencies, build scripts and tests.
- `Logs/`: human-readable English release notes. Keep one file per version; update the current release without inventing version bumps.
- `.maintenance/ai/oldlogs/`: internal AI/developer archive, relocated from the previous root `docs/`. Its history directory and historical baseline hashes are retained unchanged.
- `.github/`: CI workflows.
- `scripts/`: repository-level checks and npm command wrappers.
- `AGENTS.md` was removed at the author's request. Current internal guidance lives in `development/FOR AI.md` within this archive.

Root npm commands still delegate to `app/`. Build outputs remain `app/dist/`. The source ZIP generator retains embedded runtime ZIP files and creates a current hash manifest inside this archive's `manifests/` directory.
