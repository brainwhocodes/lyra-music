/** Capabilities belong to the media element, not its browser's User-Agent. */
export function libraryPlaybackSource(id: string, canPlayType: (mime: string) => string): string {
  const unsupported: string[] = [];
  if (!canPlayType('audio/ogg; codecs="vorbis"') || !canPlayType('audio/ogg; codecs="opus"')) unsupported.push('ogg');
  if (!canPlayType('audio/flac')) unsupported.push('flac');
  const source = `/api/tracks/${encodeURIComponent(id)}/play`;
  return unsupported.length ? `${source}?unsupported=${unsupported.join(',')}` : source;
}
