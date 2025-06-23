import { describe, it, expect } from 'vitest'
import { setup } from '@nuxt/test-utils'

// Simple test to verify authentication is required

describe('PUT /api/tracks/:id', () => {
  it('requires authentication', async () => {
    const nuxt = await setup({ server: true })

    await expect(
      $fetch('/api/tracks/123', {
        method: 'PUT',
        body: { title: 'Test' }
      })
    ).rejects.toThrow('Unauthorized')

    await nuxt.close()
  })
})
