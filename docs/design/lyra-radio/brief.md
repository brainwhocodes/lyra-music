# Lyra Radio: own your frequency

The user requested an anime radio identity inspired by Jet Set Radio and Bomb Rush Cyberfunk, then explicitly requested a matching brand kit, logo and Google Fonts. This continues the existing personal music application; it is not an external radio service.

Audience: people building a personal music library who enjoy anime, skate culture and expressive music interfaces. Promise: turn your own collection into a station and discover another side of it. Primary marketing action: Tune into radio. Primary product action: choose or create a station and play its seeded library queue.

References: the user's two named games establish the direction. Team Reptile's [official description and imagery](https://team-reptile.com/press/sheet.php?p=Bomb_Rush_Cyberfunk) ground the street-culture treatment. Original character, rooftop illustration and marks are generated for Lyra; no game assets are shipped. Previous warm editorial landing is recorded in `.test-data/anime-radio-before` as the before state.

Preserve all data, authentication, audio controls, library/semantic features, station artist and genre seeds, owner-only editing, upload controls, keyboard operation, narrow layouts and readable real text. No invented station catalogue, audience figures, live broadcast badges or music licensing claims. Brand artwork is decorative, not evidence of available anime songs.

Change the shared logo, favicon, typography and semantic palette throughout the existing layouts. Material composition changes are confined to the home, radio index and radio detail pages; these receive new generated page references before code. Other page templates retain their previously inspected composition, now using the shared identity. Existing marketing/auth image slots adopt the original rooftop illustration without introducing new sections.

Typography qualities: tightly condensed, heavy, poster-scale display type; crisp geometric reading type with distinguishable numerals and clear controls. Selected Google Fonts: Barlow Condensed 700/800, Space Grotesk 400/500/600/700. Archivo Black is a compared candidate, not an additional production download.

Original treatment anchor: `public/images/lyra-radio/rooftop-dj.png`. Production logo assets: transparent graffiti `wordmark.png` and headphone-L `mark.png`. Exact generation prompts and returned raw paths are in generation-records.json. Art is retained as generated; no undocumented color correction.

New page references: `/` public poster-led introduction with actual application CTAs; `/radio` station browser, search/genre filters, empty/loading/error and play actions; `/radio/[id]` player desk, seeds and owner edit. Navigation destinations remain the existing 26 routes listed in ../lyra/page-plan.json. The shared shell retains navigation order, labels and responsive behavior.
