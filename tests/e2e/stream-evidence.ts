import { expect, type Locator, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectTrackWaveform } from './player-controls';
import { remainingStreamErrors } from '../helpers/stream-error-evidence';

const fixtures = {
  'the-distant-sun': { title: 'The Distant Sun', bytes: readFileSync('tests/fixtures/music/audio/the-distant-sun.mp3') },
  'signal-to-noise': { title: 'Signal to Noise', bytes: readFileSync('tests/fixtures/music/audio/signal-to-noise.mp3') },
};
type TrackId = keyof typeof fixtures;

/** Every original request must acquire its own completion/corruption/cancel proof. */
export function originalStreamEvidence(page: Page) {
  const requests: Request[] = [], failures: Request[] = [];
  const qualified = new Set<Request>();
  const isOriginal = (request: Request) => /^\/api\/tracks\/[^/]+\/stream$/.test(new URL(request.url()).pathname);
  page.on('request', request => { if (isOriginal(request)) requests.push(request); });
  page.on('requestfailed', request => { if (isOriginal(request)) failures.push(request); });
  const forTrack = (id: TrackId) => requests.filter(request => new URL(request.url()).pathname === `/api/tracks/${id}/stream`);
  async function extent(request: Request, bytes: number) {
    expect(request.method()).toBe('GET');
    const response = await request.response();
    expect(response?.status()).toBe(206);
    expect(response?.headers()['content-range']).toBe(`bytes 0-${bytes - 1}/${bytes}`);
    expect(response?.headers()['content-length']).toBe(String(bytes));
  }
  return {
    async complete(id: TrackId, player: Locator, attempt = 0, receivedBody?: Buffer) {
      await expect(player).toContainText(fixtures[id].title);
      const waveform = await expectTrackWaveform(player);
      await expect(player).toContainText(fixtures[id].title);
      const attempts = forTrack(id);
      expect(attempts).toHaveLength(attempt + 1);
      await extent(attempts[attempt], fixtures[id].bytes.length);
      if (receivedBody) expect(receivedBody).toEqual(fixtures[id].bytes);
      qualified.add(attempts[attempt]);
      return waveform;
    },
    async malformed(request: Request, receivedBody: Buffer, intendedBody: Buffer, player: Locator) {
      expect(requests).toContain(request);
      expect(forTrack('the-distant-sun')).toEqual([request]);
      expect(receivedBody).toEqual(intendedBody);
      await extent(request, intendedBody.length);
      await expect(player).toContainText('The Distant Sun');
      await expect(player.getByRole('status').filter({ hasText: /^Waveform unavailable\. Seeking is still available\.$/ })).toHaveCount(1);
      await expect(player.locator('svg[aria-label="Track waveform"]')).toHaveCount(0);
      qualified.add(request); // Explicit expected invalid-input cleanup, not a decoded waveform.
    },
    async cancelled(request: Request) {
      expect(requests).toContain(request);
      await expect.poll(() => request.failure()?.errorText).toBe('net::ERR_ABORTED');
      expect(await request.response()).toBeNull(); // Held before its browser response was released.
      qualified.add(request);
    },
    assertClean(errors: string[], expectedAttempts: Partial<Record<TrackId, number>>) {
      for (const id of Object.keys(fixtures) as TrackId[]) expect(forTrack(id)).toHaveLength(expectedAttempts[id] || 0);
      expect(remainingStreamErrors(errors, requests, failures, qualified)).toEqual([]);
    },
  };
}
