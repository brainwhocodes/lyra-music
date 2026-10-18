# Lyra Radio identity

An original music-library identity with the energy of skate graphics, anime street scenes and pirate-radio flyers. The cultural references are Jet Set Radio and Bomb Rush Cyberfunk; the character, wordmark and headphone-L mark are original assets. No game characters, logos, fictional station metrics or live-broadcast claims are used.

## The system

The graffiti wordmark is the expressive signature. The headphone-L mark carries compact identity on stickers, icons and cover placeholders. The editable `LYRA RADIO` lockup uses Barlow Condensed 800 plus Space Grotesk 600. Use the mark and real text together in navigation; reserve the detailed graffiti wordmark for generous campaign areas. Keep a clear margin of at least one quarter of the mark width. Do not stretch, recolor or add effects to the supplied marks. At small sizes, prefer the live text lockup over compressing the intricate wordmark.

The brand promise is **Own your frequency.** It describes personal choice and ownership of a music collection. It is not a claim that the application broadcasts an FM station. Interface copy remains direct: “Explore your music”, “Your collection”, “Play”, “Search”.

## Real typefaces

| Role | Family | Exact weight | Use |
|---|---|---:|---|
| Campaign display | Barlow Condensed | 800 | Short uppercase statements; 80–128px on the board |
| Section heading | Barlow Condensed | 700 | Compact labels and strong section titles |
| Reading | Space Grotesk | 400 | Sentences, descriptions and field values |
| Secondary text | Space Grotesk | 500 | Supporting information and numerals |
| Interface labels | Space Grotesk | 600 | Navigation, concise labels and controls |
| Primary action | Space Grotesk | 700 | Short action labels |

Barlow Condensed is designed by Jeremy Tribby. The official Google Fonts metadata provides genuine normal and italic styles from 100–900, including the selected normal 700 and 800 files. [Official metadata](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/METADATA.pb) · [Specimen](https://fonts.google.com/specimen/Barlow+Condensed).

Space Grotesk is designed by Florian Karsten. Its official variable font has a weight axis of 300–700; all four selected interface weights lie within that range. [Official metadata](https://github.com/google/fonts/blob/main/ofl/spacegrotesk/METADATA.pb) · [Specimen](https://fonts.google.com/specimen/Space+Grotesk).

**Archivo Black alternative:** Omnibus-Type's Archivo Black is a genuine normal **400** style despite its heavy visual weight. Do not request 800 and synthesize bold. Compared with Barlow Condensed, it has a broader, blockier poster silhouette and needs more horizontal space. It is an optional campaign-only alternative, not a third font in the selected system. Barlow Condensed wins for narrow radio panels, long collection names and dense display headings. [Official metadata](https://github.com/google/fonts/blob/main/ofl/archivoblack/METADATA.pb) · [Specimen](https://fonts.google.com/specimen/Archivo+Black).

All three families publish SIL Open Font License 1.1 files in the official Google Fonts repository. Preserve each family's copyright and license when bundling font files. The board loads the two selected families from the Google Fonts CSS API; the application should self-host the selected weights with those notices. Sources checked 2026-10-18: [Barlow Condensed license](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/OFL.txt), [Space Grotesk license](https://github.com/google/fonts/blob/main/ofl/spacegrotesk/OFL.txt), [Archivo Black license](https://github.com/google/fonts/blob/main/ofl/archivoblack/OFL.txt).

## Palette and roles

The table and downloadable board below preserve the original identity edition.
The current application uses the later [listening-layout palette](ux-v2/design-review.md#final-art-direction):
cool concrete `#f3f4f6` reading surfaces, `#e4e7ec` secondary surfaces and white
inputs, with the same ink, acid, orange and blue. This follows the user's updated
preference for cooler neutrals. Historical board images and their checksums have
not been silently rewritten.

| Token | Hex | Purpose | Text pairing |
|---|---|---|---|
| Ink | `#17191c` | Main structure, outlines and text | Bone or acid on ink |
| Bone | `#f5f2e9` | Reading surfaces | Ink on bone |
| Acid | `#d7ff3f` | Primary action and identity emphasis | Ink on acid |
| Orange | `#ff7144` | Artwork, stickers and selected emphasis | Ink on orange |
| Blue | `#3b4fd8` | Secondary panels and focus on light surfaces | Bone on blue |

Acid is the main signal, not a body-text color on bone. Orange and blue are supporting inks rather than a multicolor status system. Keep error, warning and success messages explicit in words and icons; do not rely on these colors alone. The board uses flat color, 2–3px outlines and small solid offset shadows. No glows, glass panels or gradient UI surfaces.

## Composition and imagery

The editable overview is a two-column, three-row board, 1440px wide. The opening pair gives equal weight to a large typographic statement and the rooftop DJ. Lower panels show typography, semantic palette, a static product application and sticker applications. All visible text is at least 14px. The identity supports angular graphic accents, but interactive controls remain upright and readable.

Use the rooftop illustration as a substantial image, not a tiny background thumbnail. Its left side provides open space for headings; keep the DJ's face, headphones and footwear within the crop. The board crops toward the right for its narrower artwork panel. Small utility screens should reduce or omit artwork rather than placing form controls on top of the character.

Assets are referenced directly from `public/images/lyra-radio/`: `rooftop-dj.png`, `wordmark.png`, and `mark.png`. The PNG artwork remains raster; all board text, panel geometry, color swatches and specimens remain editable HTML/CSS. The application sample is a static visual study, with no functioning controls or invented library data.

## Files and verification

- `brand-board.html`: editable board, real font imports and relative image references.
- `tokens.css`: semantic palette and type tokens; no application styles are changed.
- `brand-board.png`: full-page Chromium render of the actual HTML.
- `render-board.mjs`: run with `node docs/design/lyra-radio/render-board.mjs` from the repository root.
- `brand-board.verification.json`: font loading and network evidence, decoded image dimensions, minimum text size, panel bounds and console/request errors.

The renderer explicitly loads all six selected font/weight combinations and waits for decoded images before capture. It fails for missing fonts/images, network errors, text below 14px, board width drift or panel overflow. A browser render is required after editing the fixed presentation dimensions. This static presentation has no interactive journey to exercise; it is not a responsive application mockup or evidence of application behavior.
