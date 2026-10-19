# Landing page visual review

## First production pass

Captured all three routes at 1920, 1024, 768, 390 and 320 CSS pixels, plus 320px with a 200% root font size. Screenshots and factual observations are preserved under `iterations/first-pass/`; independent adversarial reviewers reproduced the failures.

- All normal-size desktop/tablet routes loaded without page errors or failed first-party requests. No measured text was below 14px.
- The Features transport illustration overflowed at 320/390 because a grid's intrinsic width and waveform bars could not shrink.
- All three routes overflowed at 320px with 200% text. The failing measurements provide a negative control for the reflow checks.
- Nuxt's rendered icon class is `iconify`, but initial marketing styles targeted `.icon`. This left small glyphs inside large reserved boxes. The final selectors must target the actual rendered class.
- The home hero's centered cover crop cut the top of the DJ's head at 1920. The art needs top-biased positioning.
- Features and Self-host hero copy backgrounds did not fill the hero height, creating stepped notches where art began at 35% and copy extended to 48%.
- First-pass full-page heights were Home 5312px, Features 6160px and Self-host 5848px. The latter two had more vertical padding than their frozen references. Section spacing and the tools/setup rows were tightened in source.
- Station preview rows use about 45vw for the artwork below 500px; declaring 84vw requested unnecessarily large mobile assets. Square album previews remain full width on those narrow layouts.

## Repairs prepared from observed failures

Mobile grids use zero-minimum fractional tracks; their children may shrink. Headings and long words have a wrapping fallback for enlarged text. The graphic waveform uses flexible bars and a viewport-scaled gap, without a hard per-bar minimum. Small player headers wrap; lyric timestamps can occupy their own line. These are illustrations, not the functional audio player.

The two multi-section subpages use a tighter section rhythm. The home hero uses the original artwork with its top edge retained; the other hero copy columns stretch through the entire hero. Actual `.iconify` selectors size the feature pictograms. The clock's text label has its own class so its background cannot accidentally style the icon's mask element.

## Second production pass

All 18 route/viewport combinations fitted their actual viewport with zero measured horizontal text overflow, zero page errors, zero failed first-party requests and no measured text below 14px. These observations are retained in `iterations/second-pass/visual-observations.json`. The final desktop heights were already much closer to the 5000px references: Home 5206px, Features 5432px and Self-host 5156px.

Visual inspection of the three side-by-side comparisons and legible desktop crops confirmed the home DJ's face/headphones, full-height hero copy backgrounds, properly sized feature icons, and the repaired 24h clock. The original crops, section order and relative color fields are preserved. Browser fonts, semantic sentence-case headings, corrected product copy and expanded native FAQ content intentionally differ from the generated raster reference. The diagram uses live icons rather than pretending generated equipment pictures are real hardware products. These are close compositional implementations, not a pixel-perfect claim.

Independent mobile review nevertheless found an important failure that zero-overflow checks missed: at 320px with 200% text, Home station title columns narrowed to about 43px and Features station titles to 14.6px, producing vertical letter strips. The new targeted `verify-station-reflow.mjs` regression fails against that production build; the failure and original screenshots are preserved in `iterations/station-negative-control/`.

The repair uses wrapping flex rows with text-relative minimum bases, so enlarged text makes the image and title stack. Mobile padding leaves enough usable width for whole words, including genre chips. `iterations/station-candidate/` records an explicitly labeled experiment with the exact pending Vue scoped styles injected into the real browser. Candidate screenshots were inspected: Home title width is 201px and Features is 189px at 320px/200%, with full readable words. Candidate injection was not treated as final production proof. The capture script records title width in em and fails below 2.5em, alongside the document-fit observations.

## Comparison method

`compare.mjs` checks the frozen reference export SHA-256, places the actual 1920px screenshot beside it at the same scale, and creates a 50% alpha overlay. Images align at the top; the shorter image is padded only below its content. There is no nonuniform stretch, crop, or change of reference to match the implementation. ODiff is not installed, so no ODiff or pixel-match score is claimed. The generated raster typography is not treated as an exact browser golden; review focuses on section order, hierarchy, subject crop, image-to-copy balance and content depth.

All 32 unique accessible-name/destination link groups have been operated on the actual production preview. Repeated equivalent header/footer and opening/closing links are counted and represented once. Skip links receive keyboard activation and focus the main landmark. Protected destinations reach the actual unauthenticated login route, and GitHub links reach their external destinations. `after/link-journeys.json` preserves each observed URL and assertion. Authenticated destination and FAQ keyboard journeys are maintained separately in `tests/e2e/brand-journeys.spec.ts` by the root task.

## Final production confirmation — 2026-10-19

The coordinated production build includes the station reflow repair. The six targeted cases in `after/station-reflow/results.json` all pass with `injectedCandidateCss: false`. At 320px with 200% text, Home retains a 201px title column and Features retains 189px. The actual production crops were inspected: artwork and text stack, whole words remain readable, genre chips fit, and no title collapses into a vertical letter strip.

The full capture was rerun for all 18 route/viewport/text-scale combinations. Every page has exactly one main landmark, every captured image decoded successfully, and there are no measured horizontal overflows, measured text sizes below 14px, page/console errors or failed first-party requests. Desktop natural page heights remain 5206px / 5432px / 5156px. The three side-by-side comparisons, overlays and legible detail crops were regenerated from those captures; visual inspection confirms the intended hierarchy, artwork crops, section order and color rhythm. Browser text and the documented semantic adaptations remain intentional differences from the generated references.

All 32 unique accessible-name/destination link groups passed again on the final build, including keyboard activation of the skip links, real unauthenticated login redirects and HTTP 200 responses from the linked GitHub documents. These observations use Chromium with controlled viewports and text scaling. They do not imply physical-device testing, WebKit/Firefox coverage or a pixel-perfect visual match.
