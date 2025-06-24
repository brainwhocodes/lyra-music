import { describe, it, expect } from 'vitest'
import { setup } from '@nuxt/test-utils'

// Verify authentication is required for subscribing

describe('POST /api/podcasts', () => {
  it('requires authentication', async () => {
    const nuxt = await setup({ server: true })

    await expect(
      $fetch('/api/podcasts', {
        method: 'POST',
        body: { feedUrl: 'https://example.com/feed' }
      })
    ).rejects.toThrow('Unauthorized')

    await nuxt.close()
  })
})
