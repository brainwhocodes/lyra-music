# Lyra Radio visual review

The root reviewer inspected all three generated-reference/production comparisons
after build 3, plus the desktop landing and radio detail captures, narrow browser
preview and doubled-text radio captures. An independent reviewer inspected the
desktop, tablet, mobile and 320px radio views. Final build 4 passed all 53
production browser journeys. Its nine normal home/radio captures have identical
SHA-256 hashes to the inspected build 3 captures; the only application changes
between those builds are the two dialog focus guards. The comparisons and
manifest now point to `.test-data/anime-radio-build4-production`.

## Composition and deliberate adaptations

- **Home:** the rendered page keeps the acid hero, original DJ, condensed
  statement, ink promise strip, three feature columns and orange closing panel.
  The existing marketing shell supplies page margins, navigation and footer.
  Real Space Grotesk body text and live buttons replace generated lettering.
  The left copy now has one continuous solid panel; the first browser version's
  uneven text backgrounds were removed. The corrected desktop crop retains the
  face and headphones. Copy describes the actual local library and seeded queue.
- **Radio index:** the large poster, outlined rows and acid play action follow
  the reference. Existing navigation, search labels and controls remain. There
  is one real fixture station; the reference's invented second station is not
  presented as actual data. The poster stacks below the narrow breakpoint.
- **Radio detail:** the ink listening panel, standalone mark, right-side artwork
  and two seed sections carry the reference's hierarchy. A current-track block
  appears only when this station owns the player queue. The generated waveform,
  duplicate player and replacement navigation are omitted. At tablet width the
  image becomes a horizontal strip; its corrected top alignment keeps the DJ's
  face visible. Narrow controls and seed groups stack instead of clipping.

The raster character and logos are standalone generated assets, not crops of
mockup interface screenshots. Font weights are actual locally loaded Barlow
Condensed 700/800 and Space Grotesk 400–700. Primary actions use ink on acid;
ordinary links use blue on bone; selected track titles use ink on gray. The
browser review caught and corrected both low-contrast foreground combinations.

## Evidence and limits

`manifest.json` records the selected references, production captures, dimensions
and SHA-256 hashes. `*-comparison.webp` pairs each reference with its actual
desktop page at a uniform 720px width; `*-overlay.webp` uses a 50% production
overlay. Full aspect ratios are retained. ODiff is unavailable on this Windows
host, so these are manual comparisons, with no numerical fidelity claim. The
generated references are art direction, not exact browser geometry.

Full-page doubled-text screenshots can draw the fixed global player across the
middle of the stitched page. They establish overall reflow, but cannot alone
prove that the covered controls are reachable. The passing desktop doubled-text
journey additionally scrolls to each enabled radio control, checks its center
and four inset corners against the native hit target, and captures individual
viewport evidence. The root reviewer inspected the Play and artist-seed views;
both are clearly visible above the actual fixed player. Disabled Next is
separately captured and asserted disabled. This is text/rem scaling at 1440px,
not a claim of browser-chrome zoom or doubled text at every viewport.

`home-desktop.png` is an exact copy of the final desktop landing journey's
viewport screenshot for convenient preview. Route renders do not imply every
control was operated; the coverage matrix records that distinction and the
remaining untested occurrences. See `../browser-verification.md` for the final
run, the focused inventory-readiness follow-up and coverage limits.
