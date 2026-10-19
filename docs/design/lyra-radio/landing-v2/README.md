# Lyra landing pages, edition 2

Three page-specific image-generated references guide the redesign of `/`, `/features` and `/self-host`. The separate ten radio concepts remain unselected; their application layouts are not implemented here.

## References and exports

| Route | Untouched generation | Requested-size export |
| --- | --- | --- |
| `/` | [Home original](originals/home.png) | [Home 1920 × 5000](mockups/home-1920x5000.png) |
| `/features` | [Features original](originals/features.png) | [Features 1920 × 5000](mockups/features-1920x5000.png) |
| `/self-host` | [Self-host original](originals/self-host.png) | [Self-host 1920 × 5000](mockups/self-host-1920x5000.png) |

The built-in image generator was explicitly asked for 1920 × 5000. It returned 778 × 2021 for Home and 778 × 2022 for the other pages. The exact-size exports are **upscaled presentation exports**, made with aspect-preserving contain resizing and a few pixels of cool-gray padding. They are not native 1920 × 5000 model output. Originals remain untouched. `generation-records.json` records the exact submitted prompts, actual attached references, dimensions and SHA-256 hashes. Text files beside the originals also preserve the submitted prompts.

The reference roles are explicit: the existing rendered brand board provides identity, each fresh before capture provides current content and behavior, and the actual rooftop/platform/record-room artwork provides subject and pose. The brand board's historical bone/cream surface is overridden by the current cool-concrete palette. Generated text mistakes and unsupported claims are corrected in live HTML.

## Production art

The three main illustrations are separate original artwork files, never slices of the page mockups. Six new cover illustrations were separately generated with the selected page and brand board attached, then inspected for subject, anatomy, silhouette, color and intended crop:

- After hours: profile of a woman in orange headphones in a rainy blue city.
- Concrete rhythm: elevated railway, orange sky, concrete columns and overhead cables.
- Open sky: a listener looking upward, blue headphones and white summer clouds.
- Midnight Signals: railway tracks and pink dusk.
- Silhouettes: two orange koi among blue lily leaves.
- Stray Light: white circular paint and orange splashes on black.

`assets/originals/` preserves their full-resolution outputs. `assets/generation-records.json` and `assets/prompts.json` preserve generation provenance. `artwork-inputs.json` is consumed by the shared responsive export pipeline. Production uses the shared `ResponsiveArtwork` component's AVIF/WebP sources and actual `sizes`, with an eagerly loaded high-priority hero and lazy lower-page artwork. The static sample track, station and artist names are explicitly labeled illustrative; these images and names do not represent the user's private music library.

## Frozen composition contract

Comparison target: each image represents the full desktop page at a **chosen CSS viewport width of 1920px**. The model did not provide browser viewport metadata. Browser height is natural content height, not a forced 5000px; any difference is recorded rather than stretched away.

| Region | Required relationships |
| --- | --- |
| Shared chrome | Original proportional logo left; Features, Self-host and Log in right. Same content gutter as sections. Header and footer are real landmarks around one main element. |
| Home hero | Acid surface, large left headline and action, substantial seated rooftop DJ on right. Essential face and headphones remain visible. |
| Home body | Ink promise strip; three portrait station sleeves beside the collection statement; dark search split; orange lyrics split; cobalt daily-recommendation strip; numbered workflow; ruled FAQ; acid CTA. |
| Features hero | Dark left copy and acid action; platform listener on right; integrated-waveform player illustration across the base. |
| Features body | Three square sleeves beside album story; orange radio section; dark search section; cool-gray lyric editor; cobalt daily recommendation diagram; tools index; FAQ; acid CTA. |
| Self-host hero | Acid left copy; record-room image on the right; direct setup and login actions. |
| Self-host body | Folder/server/browser diagram; dark requirements table; four numbered setup rows; orange/cobalt optional models; operating notes; FAQ; cobalt CTA. |

The narrow layouts are deliberate responsive adaptations, not generated mobile references: hero copy precedes a full-width, proportionally rendered illustration; two-column editorial sections stack; small cards and tables reflow; navigation wraps while retaining visible links. At <=500px the three station posters become horizontal artwork-and-title rows rather than tiny desktop posters. Cover crops preserve the focal subjects.

## Deliberate adaptations

- All copy, labels, diagrams and controls are live HTML/CSS. No flattened page image is used as the interface.
- Static player/search/editor samples are clearly captioned illustrations. Their depicted controls are decorative shapes, not nonfunctional buttons. Real nearby links enter the application.
- The home art is the original rooftop file, the Features art is `platform-session`, and Self-host is `record-room`. No new character poses are silently substituted.
- Headings below the campaign hero use sentence case, following the user's preference even where generated images used capitals.
- Generated claims about track/playlist radio seeds, automatic tag saving, perfect lyric recognition, background work while powered off, or account isolation are not treated as facts. Live text uses the actual artist/genre seed behavior, reviewable suggestions and worker semantics.
- The native FAQ provides keyboard-operable disclosure states. Generated decorative copy icons are omitted because this marketing page does not offer an installation terminal or pretend a command executed.
- Setup examples are deliberately short; the complete repository guide is the source of installation steps.

## Nuxt review

Consulted the Nuxt MCP's actual Nuxt 3 documentation: [hydration](https://nuxt.com/docs/3.x/guide/best-practices/hydration) and [useSeoMeta](https://nuxt.com/docs/3.x/api/composables/use-seo-meta). Components use deterministic SSR content, no browser APIs or model requests during setup, CSS breakpoints rather than client-only rendering, typed `useSeoMeta`, stable keyed arrays and native disclosures. The waveform illustration is deterministic and explicitly is not an analyzed audio waveform. Public pages opt out of the default layout because `MarketingShell` owns their main landmark; this avoids nested main elements and irrelevant player padding.

## Verification status

Before captures were taken from the existing production preview on 2026-10-18 at 1920px and 390px. See `before/inventory.json` for loaded routes, title/headings, links and page errors. All eight changed Vue single-file components parsed and their templates compiled with the installed Vue compiler.

The second production pass captured all three routes at 1920, 1024, 768, 390 and 320 CSS pixels, plus 320px with a 200% root font size. All 18 states had zero measured horizontal overflow, no measured text below 14px, no page errors and no failed first-party requests. The desktop page heights are 5206 / 5432 / 5156px for Home / Features / Self-host; natural content is not forced into a 5000px box. `after/` contains full-scroll screenshots, frozen-reference side-by-side comparisons and actual 50% overlays; `after/details/` contains legible crops of those screenshots. Reference hashes are checked before comparison, and the overlay script asserts that the alpha channel is retained.

The independent mobile reviewer found enlarged-text station cards that fitted the viewport but still had unreadably narrow title columns. The source is repaired, and the final production build was verified on 2026-10-19 without injecting candidate CSS. All six station reflow cases pass; at 320px with 200% text, the Home title column is 201px and the Features title column is 189px. The earlier failing build and explicitly labeled candidate experiment remain under `iterations/`; final production screenshots and measurements are in `after/station-reflow/`.

The final 18-state capture also confirms one main landmark per page, successfully decoded artwork, zero measured horizontal overflow, zero measured text below 14px and no page/console errors or failed first-party requests. All three regenerated desktop comparisons and the enlarged-text station crops were visually inspected. This is Chromium viewport and text-scaling verification, not a claim of testing physical devices or every browser engine.

The link inventory contains 32 unique accessible-name/destination groups representing 44 links across these routes. Every unique group is clicked, with equivalent repetitions counted. Real protected destinations reach login; the skip link focuses main. The application E2E suite owns authenticated destination checks and FAQ keyboard checks.

With the production build running at port 3000, reproduce the final evidence with:

```sh
node docs/design/lyra-radio/landing-v2/capture-after.mjs
node docs/design/lyra-radio/landing-v2/verify-station-reflow.mjs
node docs/design/lyra-radio/landing-v2/verify-links.mjs
node docs/design/lyra-radio/landing-v2/compare.mjs
node docs/design/lyra-radio/landing-v2/review-crops.mjs
```

These scripts inspect the real browser DOM, loaded images and destinations. The screenshot inventory alone is not a claim that interactive controls work; route/link journeys and the application E2E suite supply that evidence separately.
