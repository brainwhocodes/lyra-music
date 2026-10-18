import { test, expect, type Locator } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { audit, checkAccessibility, checkLayout, guard, login, navigate } from './helpers';
import { expectTrackWaveform, playbackPosition, pointerSeek, seekSeconds } from './player-controls';

test('public, library, player and dialog controls remain usable with text doubled', async ({ page }, info) => {
  const errors = guard(page, [{ path: '/api/auth/me', status: 401 }]);
  async function doubleText() {
    // Equivalent user stylesheet for text/rem scaling, not browser-chrome zoom.
    // It changes presentation only and never hides controls or bypasses behavior.
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    expect(await page.locator('body').evaluate(body => getComputedStyle(body).fontSize)).toBe('32px');
  }
  async function assertUnobscured(control: Locator, name: string) {
    await expect(control).toBeInViewport({ ratio: 1 });
    // Read-only hit testing verifies the real control, rather than a fixed
    // player overlay, occupies its center and inset corners after scrolling.
    const result = await control.evaluate(element => {
      const box = element.getBoundingClientRect();
      const inset = Math.min(4, box.width / 4, box.height / 4);
      const points = [[box.x + box.width / 2, box.y + box.height / 2], [box.left + inset, box.top + inset], [box.right - inset, box.top + inset], [box.left + inset, box.bottom - inset], [box.right - inset, box.bottom - inset]];
      return { box: { x: box.x, y: box.y, width: box.width, height: box.height }, points: points.map(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return { x, y, ownTarget: !!hit && (hit === element || element.contains(hit)), hit: hit?.tagName };
      }) };
    });
    expect(result.points.every(point => point.ownTarget), name + ' must not be covered: ' + JSON.stringify(result)).toBe(true);
    return { name, ...result };
  }
  await page.goto('/');
  await doubleText();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await checkLayout(page);
  await audit(page, info, 'text200-public');
  const guestSession = page.waitForResponse(response => response.url().endsWith('/api/auth/me') && response.status() === 401);
  await page.getByRole('link', { name: 'Open your library', exact: true }).click();
  await guestSession;
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  await doubleText();
  await expect(page.getByRole('button', { name: 'Open navigation menu', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true })).toHaveCount(0);
  await checkLayout(page);
  await audit(page, info, 'text200-library');
  await navigate(page, 'Albums');
  await page.getByRole('link', { name: 'Monomyth', exact: true }).click();
  await expect(page).toHaveURL(/\/albums\/album-the-distant-sun$/);
  await page.getByRole('button', { name: 'Play album', exact: true }).click();
  await page.getByRole('button', { name: /^Open full screen player:/ }).click();
  const player = page.getByRole('dialog', { name: 'The Distant Sun', exact: true });
  await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await seekSeconds(player, 3);
  await checkLayout(page);
  await audit(page, info, 'text200-player');
  const { waveform } = await expectTrackWaveform(player);
  const position = playbackPosition(player);
  await position.scrollIntoViewIfNeeded();
  await assertUnobscured(position, 'Waveform seek bar at doubled text');
  await pointerSeek(player, 0.5);
  await seekSeconds(player, 3);
  await waveform.scrollIntoViewIfNeeded();
  await expect(waveform).toBeInViewport({ ratio: 1 });
  await checkLayout(page);
  await audit(page, info, 'text200-waveform');
  await checkAccessibility(page, info, 'text200-waveform');
  const wideVolume = player.getByRole('button', { name: 'Volume', exact: true });
  await wideVolume.scrollIntoViewIfNeeded();
  await wideVolume.click();
  const wideLevel = player.getByRole('slider', { name: 'Volume level', exact: true });
  await expect(wideLevel).toBeInViewport({ ratio: 1 });
  await assertUnobscured(wideLevel, 'Volume level at desktop width and doubled text');
  await wideLevel.focus(); await wideLevel.press('End'); await wideLevel.press('ArrowLeft');
  await expect(wideLevel).toHaveValue('99');
  await audit(page, info, 'text200-volume');
  await checkLayout(page);
  await checkAccessibility(page, info, 'text200-volume');
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 800 });
  const resizeState = async () => {
    const expanded = await wideVolume.getAttribute('aria-expanded');
    return {
      expanded, viewport: page.viewportSize(),
      panel: expanded === 'true' ? await player.getByRole('group', { name: 'Volume controls', exact: true }).boundingBox() : null,
    };
  };
  const safelyFitsOrClosed = async () => {
    const state = await resizeState();
    if (state.expanded === 'false') return true;
    const box = state.panel;
    return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= state.viewport!.width + 1 && box.y + box.height <= state.viewport!.height + 1;
  };
  await expect.configure({ soft: true }).poll(safelyFitsOrClosed, { message: 'An open volume popover must reflow into the resized viewport or close' }).toBe(true);
  await writeFile(info.outputPath('text200-volume-resize.json'), JSON.stringify(await resizeState(), null, 2));
  await audit(page, info, 'text200-volume-resize');
  if (await wideVolume.getAttribute('aria-expanded') === 'true') await page.keyboard.press('Escape');
  await expect(wideVolume).toBeFocused();
  await expect(wideVolume).toHaveAttribute('aria-expanded', 'false');
  // Combine narrow reflow and user text scaling, rather than inferring the
  // combined case from two separate passing viewport/font checks.
  try {
    const overflowSnapshot = () => page.locator('body *').evaluateAll(elements => ({
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      documentScrollLeft: document.documentElement.scrollLeft,
      elements: elements.map(element => {
        const box = element.getBoundingClientRect(), style = getComputedStyle(element);
        return { tag: element.tagName, name: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 75), class: element.getAttribute('class'), inDialog: !!element.closest('dialog[open]'), x: box.x, right: box.right, width: box.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft, overflowX: style.overflowX, display: style.display, visibility: style.visibility };
      }).filter(element => element.width > 0 && element.visibility !== 'hidden' && element.display !== 'none' && (element.x < -1 || element.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1)),
    }));
    const beforeSeekScroll = await overflowSnapshot();
    const seek = playbackPosition(player);
    await seek.scrollIntoViewIfNeeded();
    await writeFile(info.outputPath('text200-compact320-overflow.json'), JSON.stringify({ beforeSeekScroll, afterSeekScroll: await overflowSnapshot() }, null, 2));
    await audit(page, info, 'text200-compact320-transport');
    await checkLayout(page, true);
    const regionWidths = await Promise.all([player, player.getByRole('region', { name: 'Now playing', exact: true })].map(region => region.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }))));
    for (const widths of regionWidths) expect.soft(widths.scrollWidth, 'Doubled-text 320px dialog/transport must reflow: ' + JSON.stringify(widths)).toBeLessThanOrEqual(widths.width + 1);
    await assertUnobscured(seek, 'Waveform seek bar at 320px and doubled text');
    await pointerSeek(player, 0.5);
    await seekSeconds(player, 4);
    await seek.press('ArrowLeft');
    await expect(seek).toHaveValue('3.9');
    await seekSeconds(player, 3);
    const mainPlay = player.getByRole('button', { name: 'Play playback', exact: true });
    const playBox = await mainPlay.boundingBox();
    expect(playBox).not.toBeNull();
    expect.soft(Math.abs(playBox!.width - playBox!.height), 'The primary circular Play control must keep equal width and height at doubled text: ' + JSON.stringify(playBox)).toBeLessThanOrEqual(1);
    await waveform.scrollIntoViewIfNeeded();
    await audit(page, info, 'text200-compact320-waveform');
    const volume = player.getByRole('button', { name: 'Volume', exact: true });
    await volume.scrollIntoViewIfNeeded();
    await assertUnobscured(volume, 'Volume disclosure at 320px and doubled text');
    await volume.click();
    await expect(volume).toHaveAttribute('aria-expanded', 'true');
    const level = player.getByRole('slider', { name: 'Volume level', exact: true });
    await level.scrollIntoViewIfNeeded();
    await assertUnobscured(level, 'Volume level at 320px and doubled text');
    await level.focus(); await level.press('End'); await level.press('ArrowLeft');
    await expect(level).toHaveValue('99');
    await audit(page, info, 'text200-compact320-volume');
    await checkLayout(page);
    await page.keyboard.press('Escape');
    await expect(volume).toBeFocused();
    await expect(volume).toHaveAttribute('aria-expanded', 'false');
    await expect(position).toHaveValue('3');
  } finally {
    await page.setViewportSize(originalViewport);
  }
  await player.getByRole('button', { name: 'Close full screen player', exact: true }).click();
  await expect(player).not.toBeVisible();
  await navigate(page, 'Playlists');
  await page.getByRole('button', { name: 'New Playlist', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Playlist', exact: true });
  await expect(dialog.getByLabel('Playlist Name', { exact: true })).toBeFocused();
  await dialog.getByLabel('Playlist Name', { exact: true }).fill('Readable at double text size');
  await expect(dialog.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
  const geometry = async () => dialog.evaluate(element => [element, ...element.children].map(node => {
    const box = node.getBoundingClientRect(), style = getComputedStyle(node);
    return { tag: node.tagName, class: node.className, x: box.x, y: box.y, width: box.width, height: box.height, opacity: style.opacity, visibility: style.visibility, transform: style.transform, translate: style.translate, scale: style.scale, animations: node.getAnimations().map(animation => ({ state: animation.playState, timing: animation.effect?.getComputedTiming() })) };
  }));
  const before = await geometry();
  // Observe the finite native opening animations before capturing the settled
  // view. This waits for real browser state and does not alter presentation.
  await dialog.evaluate(async element => {
    await Promise.allSettled(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished));
  });
  const after = await geometry();
  await writeFile(info.outputPath('text200-dialog-geometry.json'), JSON.stringify({ before, after }, null, 2));
  await expect(dialog.getByRole('heading', { name: 'Create New Playlist', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByLabel('Playlist Name', { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('button', { name: 'Create', exact: true })).toBeInViewport({ ratio: 1 });
  await checkLayout(page);
  await audit(page, info, 'text200-dialog');
  await checkAccessibility(page, info, 'text200-dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'New Playlist', exact: true })).toBeFocused();
  await navigate(page, 'Radio');
  await expect(page.getByRole('heading', { name: 'Find your frequency.', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search stations', exact: true }).fill('Quiet');
  await checkLayout(page);
  await audit(page, info, 'text200-radio');
  await checkAccessibility(page, info, 'text200-radio');
  const radioSearch = page.getByRole('searchbox', { name: 'Search stations', exact: true });
  const radioFilter = page.getByRole('combobox', { name: 'Filter by genre', exact: true });
  const toolbarTargets = [];
  for (const [control, label, surface] of [[radioSearch, 'Search stations', 'text200-radio-search'], [radioFilter, 'Filter by genre', 'text200-radio-filter']] as const) {
    await control.scrollIntoViewIfNeeded();
    await control.click({ trial: true });
    toolbarTargets.push(await assertUnobscured(control, label));
    await audit(page, info, surface);
  }
  await info.attach('text200-radio-toolbar-hit-targets', { body: JSON.stringify(toolbarTargets, null, 2), contentType: 'application/json' });
  await writeFile(info.outputPath('text200-radio-toolbar-hit-targets.json'), JSON.stringify(toolbarTargets, null, 2));
  await page.getByRole('link', { name: 'Quiet hours', exact: true }).click();
  await expect(page).toHaveURL(/\/radio\/quiet-hours$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Quiet hours', exact: true })).toBeVisible();
  await checkLayout(page);
  await audit(page, info, 'text200-radio-detail');
  await checkAccessibility(page, info, 'text200-radio-detail');
  const playStation = page.getByRole('button', { name: 'Play station', exact: true });
  const nextTrack = page.getByRole('button', { name: 'Next track', exact: true });
  const editStation = page.getByRole('link', { name: 'Edit station', exact: true });
  const actionTargets = [];
  for (const [control, label, surface] of [[playStation, 'Play station', 'text200-radio-play'], [editStation, 'Edit station', 'text200-radio-edit']] as const) {
    await control.scrollIntoViewIfNeeded();
    await control.click({ trial: true });
    actionTargets.push(await assertUnobscured(control, label));
    await audit(page, info, surface);
  }
  await nextTrack.scrollIntoViewIfNeeded();
  await expect(nextTrack).toBeInViewport({ ratio: 1 });
  await expect(nextTrack).toBeDisabled(); // This station has not been started.
  await audit(page, info, 'text200-radio-next-disabled');
  await info.attach('text200-radio-action-hit-targets', { body: JSON.stringify(actionTargets, null, 2), contentType: 'application/json' });
  await writeFile(info.outputPath('text200-radio-action-hit-targets.json'), JSON.stringify(actionTargets, null, 2));
  const seedArtist = page.getByRole('link', { name: 'Scott Buckley', exact: true });
  const seedGenre = page.getByRole('link', { name: 'Ambient', exact: true });
  const seedTargets = [];
  for (const [control, label, surface] of [[seedArtist, 'Scott Buckley seed', 'text200-radio-artist-seed'], [seedGenre, 'Ambient seed', 'text200-radio-genre-seed']] as const) {
    await control.scrollIntoViewIfNeeded();
    await control.click({ trial: true });
    seedTargets.push(await assertUnobscured(control, label));
    await audit(page, info, surface);
  }
  await info.attach('text200-radio-seed-hit-targets', { body: JSON.stringify(seedTargets, null, 2), contentType: 'application/json' });
  await writeFile(info.outputPath('text200-radio-seed-hit-targets.json'), JSON.stringify(seedTargets, null, 2));
  expect(errors).toEqual([]);
});
