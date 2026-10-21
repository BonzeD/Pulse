# Pulse 1.0.0 — Liquid Glass: optical revision

## Material
- Clear transport: low-diffusion transparent centre, up to 32 px optical shoulder, squircle height derivative and air/glass Snell refraction, geometry-sized RGB displacement map. Maximum sampled displacement is 31 px, not the previous 9 px.
- Directional rim illumination is generated from the same analytic normals and laid over the material. No displacement is applied to foreground text, icons or artwork.
- Regular menus are darker than the transport for text readability; all dropdown types share their material. Circular transport controls have their own bounded geometry maps.
- One shared preference, ui.surfaceMaterial, switches live between frosted blur and optical glass; old profiles default to blur. Native window transparency is not enabled.
- Resize/mutation-driven, shared geometry cache, at most 24 visible optical surfaces, menu priority. No continuous redraw loop.
- Eco, reduced transparency and forced colours retain non-optical fallbacks; reduced motion remains respected.

## Scrollbars
Explicit dark color-scheme and scrollbar-color resolve the white native track produced when Chromium's scrollbar-width:thin overrides WebKit styling. Both settings scrollers remain functional and independent. The other marked gutter is not changed without clarification.

## Research
Independent implementation informed by the surface-profile / refraction explanation at https://kube.io/blog/liquid-glass-css-svg/ . The Glass-HQ architecture was also reviewed (https://github.com/Glass-HQ/liquid-glass); no React/WebGPU dependency was introduced. This is a web approximation, not native Apple Liquid Glass.

## Release constraints
Version 1.0.0; original build/installer.nsi retained byte-for-byte. Combined audio+video MP4 download and offline repair retained from the previous delivered source. Windows runtime/installation not executed in this Linux environment.

## Validation
- 208/208 unit/regression tests passed.
- Full renderer UI checks passed at 1366×768 and 390×844, Full/Clean, saved preference + reload, context/select/nested menus, optical pixel difference, scrolling and clicks, eco/reduced-transparency/forced-colors/reduced-motion, EN/JA. Actual independent wheel scrolling verified for both settings columns.
- Busy transport fixture and artwork-background screenshots visually inspected.
- File-video UI tests passed, including real local media and combined audio/video handling.
- 66 widget DOM click/command checks passed; native Windows hit testing is not claimed.
