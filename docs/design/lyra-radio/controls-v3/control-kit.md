# Editable control specimen

Open `control-kit.html` within this checkout. It uses the checked-in fonts, logo assets, control styles, and licensed audio fixture through relative paths; it is not a standalone single-file bundle.

From the repository root, render and verify it with:

```powershell
node docs/design/lyra-radio/controls-v3/render-control-kit.mjs
```

The script requires the repository's installed dependencies and Playwright Chromium. If Chromium is missing, install it with `corepack pnpm exec playwright install chromium`.

Paths resolve from the script location rather than the current working directory. The script temporarily serves the specimen and its allowed assets on `127.0.0.1:3210`, then closes the browser and server. It does not start or build the application, and does not use ports 3100 or 3101. Port 3210 must be available.

The verifier exercises 39 controls or explicitly asserts their disabled state. It checks real MP3 playback, pause, keyboard and pointer seek, repeat, mute and volume, the Volume disclosure's Enter/Escape behavior and focus return, form validation, local actions, and the music attribution link. Form actions remain local to the specimen. Its decorative waveform is explicitly illustrative, not decoder output.

It verifies fonts and images, browser/network errors, accessibility, and overflow at 1440, 390, and 320 pixels. Desktop and mobile run the interactions; the compact viewport repeats layout and accessibility checks. A deliberately incorrect assertion after clearing the search supplies a negative control.

Outputs are regenerated under `after/`:

- `control-kit-desktop.png`, `control-kit-mobile.png`, and `control-kit-compact.png`
- `control-kit-volume-desktop.png` and `control-kit-volume-mobile.png`
- `control-kit-verification.json`, including the control inventory, coverage, loaded assets, viewport geometry, screenshot hashes, and negative-control result
