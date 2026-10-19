# Lyra artwork and responsive delivery

Three original illustrations extend the rooftop character into a night transmission, train platform and record room. `originals/` retains the untouched image-generation outputs; `prompts.json` and `generation-records.json` retain the exact prompts, reference paths and output provenance. These are original anime street-radio scenes, not borrowed game art.

Run `pnpm artwork:build` to reproduce the delivery assets. Sharp creates AVIF and WebP at 96, 160, 320, 480, 768, 1024 and 1536 pixels when the original supports each size, and retains its native maximum. Small variants serve the preview thumbnails and genre icons without fetching a full card image. It never enlarges a production asset. The source hash, source size, each encoded size and SHA-256 are recorded in `responsive-assets.json`; intrinsic dimensions and available widths are in `utils/artwork-manifest.json`.

`ResponsiveArtwork` emits a native SSR picture with AVIF/WebP width descriptors, explicit intrinsic dimensions and consumer-specific `sizes`. Hero art is eager with high fetch priority; lower-page art is lazy. The same pipeline includes the seven regenerated genre illustrations, the existing rooftop art and six independent sleeve illustrations made for the longer landing pages. User-supplied private album covers retain the existing cover delivery path.

The radio page uses a restrained CSS pan while a station plays. It pauses when the art is off-screen, the tab is hidden, audio is loading/paused, or reduced motion is requested. An independent 44px control pauses/resumes the illustration without changing audio playback. This is ambient artwork motion, not audio-reactive beat analysis.

The ten radio layout explorations remain in `../radio-explorations-v1/` for the user's selection. New artwork and responsive repairs do not choose one of those layouts. The separate longer marketing-page references and implementation evidence are in `../landing-v2/`.
