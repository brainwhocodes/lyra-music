import { describe, it, expect } from 'vitest'
import { findAudioFiles } from '~/server/utils/scanner'
import { tmpdir } from 'os'
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'

function createFile(path: string) {
  return writeFile(path, '')
}

describe('findAudioFiles', () => {
  it('recursively returns supported audio files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'audio-'))
    try {
      // create nested structure
      await createFile(join(root, 'a.mp3'))
      await createFile(join(root, 'ignore.txt'))

      const sub = join(root, 'sub')
      await mkdir(sub)
      await createFile(join(sub, 'b.flac'))

      const deep = join(sub, 'deep')
      await mkdir(deep)
      await createFile(join(deep, 'c.ogg'))

      const files = await findAudioFiles(root)
      const relative = files.map(f => f.replace(root + '/', '')).sort()
      expect(relative).toEqual(['a.mp3', 'sub/b.flac', 'sub/deep/c.ogg'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
