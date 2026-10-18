import { expect, type Locator } from '@playwright/test';

export const playbackPosition = (player: Locator) => player.getByRole('slider', { name: 'Playback position', exact: true });
export const positionValue = async (slider: Locator) => Number(await slider.inputValue());

/** Native keyboard events, never assignment to the range or player state. */
export async function seekSeconds(player: Locator, seconds: number) {
  const slider = playbackPosition(player);
  await expect(slider).toBeEnabled();
  await slider.focus();
  await slider.press('Home');
  for (let step = 0; step < Math.round(seconds * 10); step++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue(String(seconds));
}

export async function pointerSeek(player: Locator, fraction: number) {
  const slider = playbackPosition(player);
  await expect(slider).toBeEnabled();
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  const duration = Number(await slider.getAttribute('max'));
  await slider.click({ position: { x: box!.width * fraction, y: box!.height / 2 } });
  // Native thumb insets differ by viewport; the center is exactly halfway.
  await expect.poll(async () => Math.abs(await positionValue(slider) - duration * fraction)).toBeLessThan(0.35);
  return slider;
}

/** The waveform is decorative. Its real geometry is observed, never operated. */
export async function expectTrackWaveform(player: Locator) {
  await expect(player.getByRole('status').filter({ hasText: /^Waveform ready$/ })).toHaveCount(1);
  const waveform = player.locator('svg[aria-label="Track waveform"]');
  await expect(waveform).toBeVisible();
  await expect(waveform).toHaveAttribute('aria-hidden', 'true');
  const geometry = await waveform.evaluate(svg => {
    const viewBox = (svg as SVGSVGElement).viewBox.baseVal;
    // Played-color overlay and clipping rectangle duplicate the drawing; read
    // the source amplitude layer once, not its presentation copies.
    return { width: viewBox.width, height: viewBox.height, bars: [...svg.querySelectorAll('g.waveform-unplayed > rect')].map(bar => ({
      x: Number(bar.getAttribute('x')), width: Number(bar.getAttribute('width')),
      height: Number(bar.getAttribute('height')),
    })) };
  });
  expect(geometry.bars.length).toBeGreaterThan(10);
  expect(geometry.bars.length).toBeLessThanOrEqual(256);
  expect(geometry.width).toBeGreaterThan(0);
  const invalidBars = geometry.bars.filter(bar => !(Number.isFinite(bar.x) && Number.isFinite(bar.width) && Number.isFinite(bar.height) && bar.width > 0 && bar.height > 0 && bar.height <= geometry.height && bar.x >= 0 && bar.x + bar.width <= geometry.width + 0.1));
  expect(invalidBars, 'Actual amplitude bars must remain inside the native timeline: ' + JSON.stringify({ viewBox: [geometry.width, geometry.height], invalidBars })).toEqual([]);
  expect(new Set(geometry.bars.map(bar => bar.height)).size).toBeGreaterThan(10);
  expect(geometry.bars[0].x).toBeLessThan(geometry.width * 0.01);
  const last = geometry.bars.at(-1)!;
  expect(last.x + last.width).toBeGreaterThan(geometry.width * 0.98);
  // The amplitude drawing occupies the seek target, not a separate panel.
  const waveBox = await waveform.boundingBox(), seekBox = await playbackPosition(player).boundingBox();
  expect(waveBox).not.toBeNull(); expect(seekBox).not.toBeNull();
  expect(Math.min(waveBox!.x + waveBox!.width, seekBox!.x + seekBox!.width) - Math.max(waveBox!.x, seekBox!.x)).toBeGreaterThan(0);
  expect(Math.min(waveBox!.y + waveBox!.height, seekBox!.y + seekBox!.height) - Math.max(waveBox!.y, seekBox!.y)).toBeGreaterThan(0);
  return { waveform, geometry };
}
