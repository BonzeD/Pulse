# Pulse Immersion — third-party graphics

## Three.js r180
MIT License, copyright 2010–2025 Three.js authors.
https://threejs.org/ — https://github.com/mrdoob/three.js/tree/r180
Full license: THREE-LICENSE.txt. The bundled renderer includes the official Reflector,
EffectComposer, UnrealBloomPass, OutputPass and FXAA modules.

## Solar System Scope — Solar Textures
https://www.solarsystemscope.com/textures/
Earth day, Earth night, Earth clouds, Stars + Milky Way and Moon, 2K.
© Solar System Scope. Based on NASA imagery as described by the publisher.
Creative Commons Attribution 4.0 International (CC BY 4.0):
https://creativecommons.org/licenses/by/4.0/
Maps are used on 3D spheres; lighting, orientation, opacity, grading and atmospheric
layers are modified in the renderer. No claim of endorsement is made.

## Poly Haven — asphalt_02
https://polyhaven.com/a/asphalt_02
https://api.polyhaven.com/files/asphalt_02
Diffuse, OpenGL normal and roughness, 1K. CC0 1.0:
https://polyhaven.com/license — https://creativecommons.org/publicdomain/zero/1.0/
Used as road and rock materials with color, scale and lighting changes.

All assets are local. Opening Immersion never requests a CDN or texture website.

## Poly Haven — rock_boulder_dry
https://polyhaven.com/a/rock_boulder_dry
Diffuse and OpenGL normal, 1K. CC0 1.0 (same terms as above).
Used on original deformed island geometry.

## Baked studio environment
studio-env.png is a 128px cube-UV prefiltered map baked from the MIT-licensed
Three.js RoomEnvironment, stored in linear RGB at 1/4 intensity to avoid runtime
PMREM shader compilation. Environment intensity restores its scale.

## Water surface normal map — Three.js examples
water-normal.jpg is waternormals.jpg from the official Three.js r180 examples:
https://github.com/mrdoob/three.js/blob/r180/examples/textures/waternormals.jpg
https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/textures/waternormals.jpg
Distributed with the MIT-licensed Three.js repository (THREE-LICENSE.txt).
Used as linear normal data, tiled in independently rotated and moving layers.

## Water rendering references (not runtime dependencies)
X. Hu et al., Realistic, Real–Time Rendering of Ocean Waves:
https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/rtwave.pdf
Three.js Water example and shader:
https://threejs.org/examples/webgl_shaders_ocean.html
https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water.js
The Pulse shader is an original implementation. Its planar reflections are an
approximation, not ray tracing or a full underwater refraction simulation.

## Galactic ocean panorama
8k_stars_milky_way.jpg — Solar System Scope, CC BY 4.0.
https://www.solarsystemscope.com/textures/
https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg
The original all-sky panorama is oriented and exposure-adjusted in the ocean shader.

## Cosmic Dawn / alternate ocean panorama
- `eso-milky-way.jpg`: **ESO/S. Brunier**, The Milky Way panorama / GigaGalaxy Zoom (`eso0932a`), 6000 × 3000. CC BY 4.0. Source TIFF converted to JPEG, mapped to a spherical sky, rotated and exposure-adjusted in the shader. No AI image generation or content expansion was applied to the photograph.
  - https://www.eso.org/public/images/eso0932a/
  - https://cdn.eso.org/images/original/eso0932a.tif
  - https://www.eso.org/public/outreach/copyright/
- `nasa-earth-day.jpg`: NASA Earth Observatory, Blue Marble: Next Generation, September 2004. Source 21600 × 10800; resized to 8192 × 4096.
  - https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
  - https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/september/world.200409.3x21600x10800.jpg
- `nasa-earth-night.jpg`: NASA Earth Observatory, Black Marble 2016 (3 km). Source 13500 × 6750; resized to 8192 × 4096.
  - https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/
  - https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg
- NASA source-material use guidance: https://www.nasa.gov/nasa-brand-center/images-and-media/ . The rendered station is an original fictional Pulse visualization, not a NASA model or an approved NASA product. NASA source maps are processed for visual rendering; no NASA logos, identifiable persons, or endorsements are used.
- `earth-clouds-8k.jpg`: Solar System Scope, CC BY 4.0. https://www.solarsystemscope.com/textures/ and https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg . Converted to JPEG for local rendering.
- `station-metal-nor_gl.jpg`, `station-metal-rough.jpg`: Poly Haven, Metal Plate, CC0. https://polyhaven.com/a/metal_plate . 1K normal and roughness maps, tiled with reduced normal strength.
  - https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/metal_plate/metal_plate_nor_gl_1k.jpg
  - https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/metal_plate/metal_plate_rough_1k.jpg

## Aurora Valley / Orbital Resonance refresh
- Snow 02 diffuse and OpenGL normal: Poly Haven / Rob Tuytel, CC0. https://polyhaven.com/a/snow_02 and https://polyhaven.com/license . 1K JPGs, tiled with reduced normal strength.
- Alpine height data: Mapzen / Tilezen Terrain Tiles, AWS open terrain endpoint. https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/2135/1457.png . RGB Terrarium values decoded to meter elevations, rounded, vertically scaled and baked into alpine-elevation.mjs. The scene is an artistic visualization, not a surveying or navigation product.
- Europe terrain data produced using Copernicus data and information funded by the European Union — EU-DEM layers. Global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey. Mapzen attribution and detailed data source information: https://github.com/tilezen/joerd/blob/master/docs/attribution.md and https://github.com/tilezen/joerd/blob/master/docs/data-sources.md . The full source attribution document is bundled as TERRAIN-ATTRIBUTION.md.
- NASA day/night/cloud textures from the prior refresh are now capped at 4096 × 2048 to reduce GPU memory use. Original source names and licenses above remain applicable. Clouds are composited into one opaque Earth material, not a separate transparent shell.
- Aurora curtains, station light-track shaders, plasma and spectral geometry are original Pulse render code. No third-party aurora shader source is incorporated.

## Sakura glade
- `sakura-dawn.jpg`: AI-generated spring landscape made for this Pulse iteration; no third-party photography. Used only as a distant matte-painting backdrop. Grass, branching trees, blossoms, petals and light shafts are real-time Pulse scene code.
