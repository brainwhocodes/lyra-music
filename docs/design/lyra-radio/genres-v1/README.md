# Genre artwork

Seven individually generated illustrations extend the supplied rooftop DJ reference: electronic, rock, jazz, pop, hip-hop, ambient and a generic boombox fallback. The original reference anchors ink drawing, cel shading and the acid/cobalt/orange palette. Subjects and compositions vary; ambient deliberately shifts toward cobalt and quieter objects. These are genre illustrations, never replacements for an album's real cover.

The built-in Image Gen tool generated each asset separately. `generation-records.json` stores the exact prompts, reference path, original tool output path, reviewed source and export hashes. Lossless originals are retained here; `node scripts/export-genre-art.mjs` reproduces the 768px WebP assets under `public/images/genres/`. No grading or generated text was added.

Genre labels remain live HTML outside the image. The full genre grid uses square artwork beside the name and count; library shortcuts reuse the same art. Decorative images have empty alt text so each link's name is announced once. Known subgenre aliases resolve through `utils/genre-image-map.json`; unknown tags use the generic boombox. This changes presentation only, not the library's metadata or model tagging results.

Visual review: all seven lossless outputs inspected at generation. Browser crop, mobile layout, focus, loading-to-content and image-load evidence are captured after the production build by the browser suite.
