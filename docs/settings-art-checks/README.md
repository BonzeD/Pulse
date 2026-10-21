# settings-artwork checks — 1.0.0

Current local checks, not Windows performance or private Apple account acceptance. Full/Clean and metadata fixtures use the actual renderer; remote services are stubbed. Test artwork is the Pulse logo, not recovered user artwork. Unit 258, settings-art UI 46, kinetic/motion 50, widget 70, effect deltas 280/280. Full UI, file-video, general motion and splash completed.

Reproduce after npm install and native build/installer asset generation: npm test; CHROMIUM_PATH=/path/to/chromium npm run test:settings-art. Source ZIP excludes generated installer-ui/out and native bin/obj. Run npm run build:media and generate installer art (or npm run dist) before the complete release-version suite. Settings-art tests alone do not require a real Apple account.

scope.json and app-settings.diff document scope against kinetic-motion. asar.json verifies packaged source. portable.json/setup.json compare extracted payloads byte for byte with win-unpacked. Historical reports are not fresh audits. UI test timing corrections: wait for viewport resize before opening the dropdown; freeze splash timers during screenshot capture so host load cannot auto-dismiss the fixture. No runtime dropdown/splash behavior changed.
