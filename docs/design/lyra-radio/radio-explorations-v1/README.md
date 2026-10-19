# Lyra radio — ten concept explorations

Status: awaiting the user’s choice. These are image-generated direction studies, not implemented radio pages.

Open `index.html` in a browser. Each board pairs a desktop radio directory with a mobile station-detail screen. The gallery supports full-size viewing, zoom, previous/next and keyboard navigation. Reply in chat with a number from 01 to 10.

## Choices

| Number | Direction | What changes |
| --- | --- | --- |
| 01 | [Rooftop selector](originals/01-rooftop-selector.png) | A compact station rail keeps browsing beside a large selected-station stage. |
| 02 | [Record shop](originals/02-record-shop.png) | Six illustrated sleeves make station discovery feel like browsing a record store. |
| 03 | [Radio zine](originals/03-radio-zine.png) | An editorial spread pairs one featured station with a fast, scannable index. |
| 04 | [Transit lines](originals/04-transit-lines.png) | A graphic station map explores genre connections, with a clear list alternative. |
| 05 | [Listening desk](originals/05-listening-desk.png) | A steady three-pane workspace puts stations, current artwork and seeds side by side. |
| 06 | [Poster wall](originals/06-poster-wall.png) | Tall station posters create a bold horizontal browse experience. |
| 07 | [Cassette shelf](originals/07-cassette-shelf.png) | Compact station spines open into a cassette-inlay style listening page. |
| 08 | [Split horizon](originals/08-split-horizon.png) | An ink-and-art split gives the station identity the strongest visual presence. |
| 09 | [Street index](originals/09-street-index.png) | A typography-led station list favors fast scanning and low visual clutter. |
| 10 | [Gallery tunnel](originals/10-gallery-tunnel.png) | A vertical sequence of large artwork panels makes browsing feel cinematic. |

The design shortlist is 01 for balanced browsing, 07 for distinctive compact typography, and 08 for the strongest brand expression. All ten remain available to choose.

## Scope and interpretation

- These retain Lyra’s local-library, artist/genre-seeded radio model. There are no live-broadcast claims, audience figures or schedules.
- Station, artist and track names shown in the mockups are illustrative. They are not additions to the actual library.
- Playback uses one dominant transport and a waveform integrated with seeking. Final image refinements remove competing play buttons, improve contrast and restore a missing desktop transport.
- A selected direction will still need implementation decisions for long titles, larger collections, loading/error/empty states, owner permissions, responsive tablet layouts, keyboard focus, measured contrast and audio behavior. Generated text and icons are visual studies rather than an accessibility or functional test of the product.
- Concept 04 proposes spatial browsing with a list alternative; its lines illustrate a design metaphor, not evaluated music relationships. Concept 07’s printed spine numbers are decorative mockup output, not station ranks or playback order.

## Provenance

Generated with the built-in image_gen tool using the inspected existing Lyra brand board, actual radio screenshot and original rooftop artwork as references. No external image-generation CLI was used.

- `originals/`: exactly ten final, unmodified tool-output PNGs.
- `iterations/`: five preserved initial versions superseded by targeted image edits.
- `prompts.json`: exact original prompt for each direction and reference roles.
- `refinement-prompts.json`: exact targeted correction prompts.
- `generation-records.json`: source/output paths, generation records, hashes and image dimensions.
- `concepts.json`: stable number/name mappings and comparison descriptions.
- `screenshots/`: inspected gallery render evidence.

No color grading or manual raster painting was applied. The boards themselves were created and edited with image_gen; the comparison interface is ordinary HTML.

## Review

The main agent inspected every initial and final generated board. A separate design reviewer compared layout diversity, the local-library feature contract, control simplicity and the gallery’s responsive behavior. The gallery verification script exercises the comparison interface only; it does not claim that the raster radio UI is functioning software.
