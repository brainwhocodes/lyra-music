import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// A real local publisher outside the application boundary. The app fetches and
// parses this RSS and Chromium decodes the same licensed audio used elsewhere.
export async function startPodcastFixtureServer() {
  const audio = await readFile(resolve('tests/fixtures/music/audio/the-distant-sun.mp3'));
  let origin;
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, origin).pathname;
    if (pathname === '/feed.xml' || pathname === '/second-feed.xml') {
      const title = pathname === '/feed.xml' ? 'Listening Notes' : 'Field Notes';
      response.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
      response.end(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${title}</title><description>Original local podcast fixture with licensed Scott Buckley audio.</description><link>${origin}</link><item><title>A quieter morning</title><description>A short listening exercise using The Distant Sun by Scott Buckley, CC BY 4.0.</description><guid>${origin}/${title.replaceAll(' ', '-').toLowerCase()}-episode</guid><pubDate>Sat, 17 Oct 2026 12:00:00 GMT</pubDate><itunes:duration>00:12</itunes:duration><enclosure url="${origin}/episode.mp3" type="audio/mpeg" length="${audio.length}"/></item></channel></rss>`);
      return;
    }
    if (pathname === '/episode.mp3') {
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Math.min(Number(range[2]), audio.length - 1) : audio.length - 1;
      if (start >= audio.length || start > end) {
        response.writeHead(416, { 'content-range': `bytes */${audio.length}` });
        response.end();
        return;
      }
      response.writeHead(range ? 206 : 200, {
        'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'content-length': end - start + 1,
        ...(range ? { 'content-range': `bytes ${start}-${end}/${audio.length}` } : {}),
      });
      response.end(request.method === 'HEAD' ? undefined : audio.subarray(start, end + 1));
      return;
    }
    response.writeHead(404);
    response.end('Fixture not found');
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(Number(process.env.E2E_PODCAST_PORT || 3101), '127.0.0.1', resolveListen);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, close: () => new Promise((done) => { server.closeAllConnections(); server.close(done); }) };
}
