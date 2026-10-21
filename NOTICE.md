# Pulse — лицензия и сторонний код

С версии 2.0.8 Pulse распространяется по лицензии **GNU GPL v3.0 или более поздней** (`LICENSE`).
Причина — в Pulse встроен Mineradio, а он выпущен под GPL-3.0: производная программа должна распространяться
под той же лицензией вместе с исходным кодом. Архив `Pulse-<версия>-source.zip` — и есть этот исходный код.

## Mineradio (renderer/mineradio/)
- Автор: **oirge** — https://github.com/oirge/Mineradio (версия 2.4.4, коммит 92c460d), лицензия GPL-3.0 (`renderer/mineradio/LICENSE`).
- Изменено для Pulse: добавлены `pulse-bridge-pre.js`, `pulse-bridge.js`, `pulse-bridge.css`, `pulse-i18n.js`
  (мост к звуку/очереди/тексту Pulse и русский перевод консоли); в `index.html` подключены эти файлы вместо Folia;
  в `app.js` и `shelf-classic.js` подписи 3D-полки переведены на русский (строки с пометкой «Pulse»).
- Не включены: Folia (`vendor/folia`, AGPL) и пресет 8 «音域回响 Wallpaper Engine» (`vendor/sonic-workshop`,
  сборка автора CmzYa, не под GPL).
- Благодарности (из NOTICE Mineradio): пресет «Звуковой рельеф» — порт **Ajin** (yin-yizhen/sonic-topography) по работе
  **CmzYa** «音域回响», через форк XxHuberrr/Mineradio; визуал «Обложка» — по идее **emily**.
- Сторонние библиотеки: three.js r128, GSAP, music-tempo — MIT; шрифты Noto Sans SC / Inter — SIL OFL 1.1
  (подробно — `renderer/mineradio/THIRD-PARTY-NOTICES.md`, `renderer/mineradio/NOTICE.md`).

## Windows media bridge (1.0.0)
Собственный код native/media-bridge распространяется под GPL-3.0-or-later, как Pulse. Self-contained helper включает .NET Runtime (MIT) и Windows SDK/CsWinRT projections; лицензии и сторонние уведомления поставляются рядом с EXE в resources/media-bridge.

## Local media tools (1.0.0)

Metadata parsing: music-metadata (MIT), https://github.com/Borewit/music-metadata. Runtime dependency license files are included in app.asar/node_modules.

Windows conversion/export: FFmpeg and FFprobe 6.1.1 essentials build by gyan.dev, distributed via eugeneware/ffmpeg-static b6.1.1. GPLv3 license, full upstream build README/source references and SHA-256 provenance are included in resources/media-tools. Source reference: https://github.com/FFmpeg/FFmpeg/commit/e38092ef93 and https://www.gyan.dev/ffmpeg/builds/. Build/distribution source: https://github.com/eugeneware/ffmpeg-static.

## Immersion cinematic renderer
Three.js r180 and postprocessing/Reflector modules: MIT (Three.js authors).
Solar System Scope Earth, cloud and star maps: CC BY 4.0.
Poly Haven asphalt_02 and rock_boulder_dry materials: CC0.
Full attribution, source links and modification notes:
renderer/immersion-assets/CREDITS.md; Three.js license:
renderer/immersion-assets/THREE-LICENSE.txt.
Water normal map from official Three.js r180 examples, under the repository MIT
license. The original Pulse water shader uses displaced swell, multi-scale normal
mapping and a rough Fresnel reflection approximation. See the graphics credits.

Cosmic Dawn / ocean panorama refresh:
ESO/S. Brunier — The Milky Way panorama (eso0932a), CC BY 4.0. TIFF-to-JPEG conversion, spherical projection, rotation and exposure adjustment. https://www.eso.org/public/images/eso0932a/
NASA Earth Observatory — Blue Marble Next Generation (September 2004) and Black Marble 2016 source maps, resized for the original fictional Pulse visualization. No NASA endorsement is implied. https://www.nasa.gov/nasa-brand-center/images-and-media/
Solar System Scope 8K cloud map, CC BY 4.0; Poly Haven Metal Plate normal/roughness maps, CC0. Full URLs and processing notes: renderer/immersion-assets/CREDITS.md.

Aurora Valley / Orbital Resonance refresh:
Poly Haven Snow 02 / Rob Tuytel: CC0, https://polyhaven.com/a/snow_02 .
Mapzen / Tilezen Terrain Tiles; Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey. Full attribution and sources in renderer/immersion-assets/TERRAIN-ATTRIBUTION.md and CREDITS.md.
