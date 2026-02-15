import { describe, expect, it } from 'vitest'
import { resolveFetchPolicyOptions } from '~/composables/use-fetch-policy'

describe('resolveFetchPolicyOptions', () => {
  it('uses eager SSR for ssr-required', () => {
    expect(resolveFetchPolicyOptions('ssr-required')).toEqual({ lazy: false, server: true, immediate: true })
  })

  it('uses lazy client fetch for lazy-ok', () => {
    expect(resolveFetchPolicyOptions('lazy-ok')).toEqual({ lazy: true, server: false, immediate: true })
  })

  it('uses explicit execution for user-triggered', () => {
    expect(resolveFetchPolicyOptions('user-triggered')).toEqual({ lazy: true, server: false, immediate: false })
  })
})
