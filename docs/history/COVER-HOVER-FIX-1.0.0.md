# Cover hover fix — 1.0.0

Pointer lighting now targets `.card .ca` (artwork), not the complete catalog card including its title and subtitle. This removes the rounded highlight beneath the text. The light inherits artwork rounding, remains non-interactive, and preserves existing artwork hover lift and shadow.

Previous widget click fix, app updates, original imported installer and version 1.0.0 are unchanged.

Validation: 183 unit tests; real Chromium square/round artwork hover, clipped light bounds, title cleanup and play-button click-through. Native Windows runtime was not tested.
