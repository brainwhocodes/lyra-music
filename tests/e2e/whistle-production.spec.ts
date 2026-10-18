import { test, expect } from '@playwright/test';

// Opt in with LYRA_WHISTLE_E2E=1; no mock, API key, or cloud transcription.
test('production HTTP route transcribes real audio with Whistle and persists timed lyrics', async ({ request }, info) => {
  test.setTimeout(180_000);
  const login = await request.post('/api/auth/login', { data: { email: 'listener@example.test', password: 'LocalMusicTest123!' } });
  expect(login.status()).toBe(200);
  // APIRequestContext is not a browser; explicitly use the returned real JWT,
  // avoiding localhost Secure-cookie differences between HTTP clients.
  const { token } = await login.json();
  const headers = { authorization: `Bearer ${token}` };
  const generated = await request.post('/api/tracks/spoken-test/lyrics/generate', { headers, timeout: 170_000 });
  const body = await generated.json();
  await info.attach('real-whistle-response', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
  expect(generated.status(), JSON.stringify(body)).toBe(200);
  expect(body.lyricsJson.length).toBeGreaterThan(0);
  const text = body.lyricsJson.map((line: { text: string }) => line.text).join(' ').toLowerCase();
  expect(text).toContain('music');
  expect(text).toContain('morning');
  expect(body.source).toBe('whistle_transcription');
  expect(body.llmModelUsed).toContain('whistle');
  for (const line of body.lyricsJson) {
    expect(line.time).toMatch(/^\d{2}:\d{2}\.\d{3}$/);
  }
  const saved = await request.get('/api/tracks/spoken-test/lyrics', { headers });
  expect(saved.status()).toBe(200);
  const persisted = await saved.json();
  expect(persisted.lyricsId).toBe(body.lyricsId);
  expect(persisted.lyricsJson).toEqual(body.lyricsJson);
  expect(persisted.source).toBe(body.source);
});
