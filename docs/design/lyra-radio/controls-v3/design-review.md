# Lyra form and transport controls

The user requested substantially fewer player controls and a waveform that is the seek bar. The selected generated references are `concepts/transport.png`, `concepts/forms.png`, and `concepts/form-states.png`; exact prompts and input paths are preserved in `generation-records.json`.

## Intended implementation

- Full player: album cover, title/artist/album, a single waveform timeline, shuffle/previous/play/next/repeat, then queue, lyrics and volume. The separate analysis panel, metrics, numeric seek form, skip-ten buttons, and permanent volume percentage are removed from the listening interface.
- Desktop bar: track identity, compact transport and waveform, four secondary icon actions. Narrow bar: identity, play/pause, waveform; the full player provides secondary controls.
- The waveform is decorative data beneath a native range. It uses the complete decoded timeline, native playback duration, a visible thumb, elapsed/end times, keyboard controls and direct pointer seeking. Unavailable, oversized or unsupported audio retains a plain seek bar. A single layout owner shares successful results between player views.
- Forms: consistent white fields on cool concrete, 52px fields, 44px icon targets, 2px corners, acid primary actions, blue focus, dark red errors, neutral disabled states. Existing labels, validation, API handlers and supported fields remain authoritative.

## Deliberate adaptations from generated images

The transport reference incorrectly uses the rooftop DJ illustration as album art. Production uses the track's actual artwork or the existing headphone mark. The generated waveform is only a layout reference; production bars come from decoded audio. The compact reference places several controls along one narrow line; production keeps its waveform on a second row to preserve usable seeking width and touch targets.

Desktop secondary actions stay with the playback column, leaving the artwork as a separate visual anchor. The existing app brand header provides the full-screen dismissal control. Narrow layouts stack the artwork and controls, and the small persistent player exposes identity, Play and the same seek surface.

The first forms image invented public/collaborative/profile fields. These are excluded. The corrected states reference constrains Create New Playlist to its actual name field. Generated upload-limit wording is not adopted: existing upload validation remains the source of truth. Error text uses #9a2723 rather than the first image's low-contrast orange.

Unplayed bars and the fallback rail use #7d8796, measured at 3.30:1 against #f3f4f6. This is darker than the generated board to keep the seek extent visible. The native thumb stays centered on the waveform for familiar range interaction. Timestamps sit 8px below the control so its keyboard focus ring does not overlap them.

## Verification status

Implementation review and production browser verification are complete. Controls-v3 build 5 passed all 61 browser cases; ordinary tests passed 279 cases with six opt-in model cases skipped. The final desktop and phone player captures, enlarged-text volume state and form comparison were inspected after verification. Ten production captures, uniform-width comparisons and their SHA256 records are saved under `after/` and `verification.json`. No visual-fidelity score is claimed. See `browser-verification.md` for the test scope and explicit coverage gaps; the older `ux-v2` archive describes the prior design and is retained as history.

The first rendered production capture exposed undersized icon glyphs and an MP3 padding bin beyond the native duration. Icon sizing is now explicit and bins are clipped to the native playable interval, without stretching the remaining waveform. This first run is retained as a failing regression artifact. ODiff is not installed on this host; Sharp comparisons and manual inspection are used instead.

The editable `control-kit.html` was rendered with the production font and control styles at 1440, 390 and 320px. Its local form actions are identified as examples; its transport plays a licensed fixture and explicitly identifies the drawn waveform as illustrative. It is a developer specimen, not an additional product route. Desktop fields, validation, number-field baselines, password visibility and expanded volume were visually reviewed. The narrow board stacks the same specimens with readable labels and intact controls. `after/control-kit-mobile-regions.png` is a comparison-only contact sheet of the original 390px capture's first and last 900px, without scaling; the original full capture is retained. The kit's independent browser checks are recorded in `after/control-kit-verification.json`.

Build 2 passed the 16 focused browser cases. Subsequent visual review found that percentage padding made the placeholder mark tiny in the narrow grid and that the inherited enlarged-text button minimum made Play oval. The placeholder now uses bounded viewport padding, and circular play controls have matching minimum dimensions. A separate resize probe also reproduced an open volume panel outside the narrowed viewport; the panel now dismisses on viewport resize. The failing probe and build-2 captures remain archived rather than being replaced with repaired evidence.

Build 3 passed the enlarged-text/320px journey, including the resize and circle regressions. Its actual narrow captures show a readable fallback mark and circular transport. Newly added pointer checks found that DaisyUI raises focused inputs above the password eye button. The password wrapper now contains its stacking context and keeps the button above the input. Build 4 passed all seven focused cases, including login and registration with the password still focused at each normal width.

The build-4 desktop full player and persistent bar were visually inspected from their real playback journeys. The native seek focus outline remains distinct from the timestamps; the compact waveform has useful width beside the identity and secondary actions. The desktop login and narrow registration error state were also inspected: the eye remains within the field, the validation message has its own line, and the primary action is clear. These observations apply to the captured states, not an unmeasured visual-similarity or universal accessibility score.

The tablet and phone captures show the restored fallback artwork, a single wide timeline, circular Play and readable secondary actions. The phone's persistent player keeps its identity and Play above the waveform. Build 4's complete run passed 57 cases and exposed three instances of the same podcast-history defect plus one successful-range cleanup report. Podcast playback now bypasses music-track history; four new regression cases preserve ordinary local-track recording. The waveform guard now requires the exact successful request and a validated complete waveform before accepting its native range-cleanup abort. The mechanism and independent reproduction are documented in [the decoder evidence](../../../track-waveform.md). Build 5 compiled successfully and passed the complete browser gate. Earlier failing runs remain preserved in the verification record.

## Interaction references

The implementation uses the [WAI native media seek slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/examples/slider-seek/), [WCAG alternatives to dragging](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), [native range behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range), and [native popover dismissal](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using). These inform semantics and interaction, not visual copying.
