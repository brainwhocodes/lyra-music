/** Original deterministic PCM, no copyrighted recording or external codec involved. */
export function pcmWave(seconds: number, sampleRate = 16_000, channels = 1, amplitude: (frame: number, channel: number) => number = () => 0): Blob {
  const frames = Math.round(seconds * sampleRate);
  const dataSize = frames * channels * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, dataSize, true);
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++) {
    view.setInt16(44 + (frame * channels + channel) * 2, Math.round(amplitude(frame, channel) * 32767), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
