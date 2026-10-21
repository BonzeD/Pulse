# Pulse 1.0.0 — widget click regions

The desktop widget previously marked its whole root container as a native window-drag region. Only individual BUTTON elements were excluded; wrapper groups and nested SVGs/zoomed controls were not explicitly excluded. This can cause native drag hit-testing to intercept controls instead of dispatching their clicks.

## Change
- `renderer/widget.html`: a separate, aria-hidden background drag surface.
- `renderer/widget.css`: the root no longer declares native dragging. Control groups, all descendants, progress, volume and the double-clickable cover explicitly use `no-drag`.
- Decorative background/tint/EQ elements do not intercept pointer events.
- The lock option disables the background drag surface. Editor preview mode remains non-draggable and intentionally routes editor gestures through its existing overlay.
- Playback IPC permissions and command handlers are unchanged; no broader IPC access was granted.

## Checks
- 182 unit/source tests passed.
- `npm run test:widget-clicks`: 66 actual DOM pointer/command checks passed in Chromium with a stubbed desktop API, covering 3 widget sizes, locked/unlocked mode, all visible control buttons, seek/volume, nested SVGs and scaled controls.
- This browser test does not exercise Windows native drag hit-testing. Verify on Windows: drag the title/background, click playback/next/previous/open/hide/size, click seek/volume, toggle Lock and try configured scales/custom layout.

## Installer and version
The NSIS script and all 1,024 UI resources remain exactly those imported from the supplied `Pulse-1.0.0-source(2).zip`. All other application improvements remain. Version stays **1.0.0**. Both the Setup payload and portable build include the widget change. Outputs are unsigned and actual Windows installation is not tested in this Linux environment.
