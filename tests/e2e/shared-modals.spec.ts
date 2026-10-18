import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { audit, checkAccessibility, checkLayout, guard, login } from './helpers';

test('album, track and lyric editors persist changes and shared playlist selection supports keyboard focus', async ({ page }, info) => {
  const errors = guard(page);
  await login(page);
  await page.goto('/albums/album-the-distant-sun');
  await page.getByRole('button', { name: 'Edit metadata', exact: true }).click();
  const album = page.getByRole('dialog', { name: 'Edit Album', exact: true });
  await expect(album.getByLabel('Title', { exact: true })).toBeFocused();
  await album.getByLabel('Cover image', { exact: true }).setInputFiles(resolve('public/images/lyra/mark.png'));
  await expect(album.getByRole('img', { name: 'Album cover preview', exact: true })).toHaveAttribute('src', /^blob:/);
  await album.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(album).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit metadata', exact: true })).toBeFocused();
  for (const year of ['2021', '2019']) {
    await page.getByRole('button', { name: 'Edit metadata', exact: true }).click();
    await album.getByLabel('Year', { exact: true }).fill(year);
    const saved = page.waitForResponse(response => response.url().endsWith('/api/albums/album-the-distant-sun') && response.request().method() === 'PUT');
    await audit(page, info, 'album-editor-' + year);
    await album.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(album).not.toBeVisible();
    await page.reload();
    await expect(page.getByText(year, { exact: true })).toBeVisible();
  }
  const row = (title: string) => page.getByRole('row', { name: new RegExp(title) });
  async function openTrackAction(title: string, action: string) {
    await row(title).getByRole('button', { name: 'Open options menu', exact: true }).click();
    await page.getByRole('button', { name: action, exact: true }).click();
  }
  await openTrackAction('The Distant Sun', 'Edit Track');
  const track = page.getByRole('dialog', { name: 'Edit Track Details', exact: true });
  await expect(track.getByLabel('Title', { exact: true })).toBeFocused();
  await track.getByLabel('Title', { exact: true }).fill('   ');
  await expect(track.getByRole('button', { name: 'Save Changes', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(track).not.toBeVisible();
  await expect(row('The Distant Sun').getByRole('button', { name: 'Open options menu', exact: true })).toBeFocused();
  let previous = 'The Distant Sun';
  for (const title of ['The Distant Sun edited', 'The Distant Sun']) {
    await openTrackAction(previous, 'Edit Track');
    await track.getByLabel('Title', { exact: true }).fill(title);
    await audit(page, info, 'track-editor-' + (title.endsWith('edited') ? 'changed' : 'restored'));
    await checkAccessibility(page, info, 'track-editor');
    await track.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(track).not.toBeVisible();
    await page.reload();
    await expect(row(title).getByRole('button', { name: 'Play ' + title, exact: true })).toBeVisible();
    previous = title;
  }
  // Original user-edited text, explicitly not a transcription of this recording.
  expect((await page.request.put('/api/tracks/the-distant-sun/lyrics', { data: { lyricsJson: [] } })).ok()).toBe(true);
  await openTrackAction('The Distant Sun', 'Edit Lyrics');
  const lyrics = page.getByRole('dialog', { name: 'Edit Lyrics for The Distant Sun', exact: true });
  await expect(lyrics.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await lyrics.getByRole('button', { name: 'Add First Line', exact: true }).click();
  await lyrics.getByLabel('Time for line 1', { exact: true }).fill('00:02.000');
  await lyrics.getByLabel('Lyrics for line 1', { exact: true }).fill('Original words written for the editor test.');
  await lyrics.getByRole('button', { name: 'Add Line', exact: true }).click();
  await expect(lyrics.getByLabel('Time for line 2', { exact: true })).toBeVisible();
  await lyrics.getByRole('button', { name: 'Remove line 2', exact: true }).click();
  await expect(lyrics.getByLabel('Time for line 2', { exact: true })).toHaveCount(0);
  await audit(page, info, 'lyrics-editor');
  await checkAccessibility(page, info, 'lyrics-editor');
  await checkLayout(page);
  await lyrics.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(lyrics).not.toBeVisible();
  await openTrackAction('The Distant Sun', 'Edit Lyrics');
  await expect(lyrics.getByLabel('Lyrics for line 1', { exact: true })).toHaveValue('Original words written for the editor test.');
  await expect(lyrics.getByLabel('Time for line 1', { exact: true })).toHaveValue('00:02.000');
  await page.keyboard.press('Escape');
  await expect(lyrics).not.toBeVisible();
  await page.goto('/discovery/local-discoveries');
  await openTrackAction('The Distant Sun', 'Add to Playlist');
  const add = page.getByRole('dialog', { name: 'Add The Distant Sun to Playlist', exact: true });
  await expect(add.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await audit(page, info, 'shared-playlist-picker');
  await checkAccessibility(page, info, 'shared-playlist-picker');
  const refreshedDiscovery = page.waitForResponse(response => response.url().endsWith('/api/discovery-playlists/local-discoveries') && response.ok());
  await add.getByRole('button', { name: 'Local listening', exact: true }).click();
  await expect(add).not.toBeVisible();
  await refreshedDiscovery;
  await page.goto('/playlists/local-listening');
  await expect(row('The Distant Sun')).toHaveCount(1);
  expect(errors).toEqual([]);
});
