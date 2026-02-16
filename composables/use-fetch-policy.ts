export type FetchPolicy = 'ssr-required' | 'lazy-ok' | 'user-triggered'

interface PolicyOptions {
  server?: boolean
}

export const resolveFetchPolicyOptions = (policy: FetchPolicy, options: PolicyOptions = {}) => {
  const server = options.server ?? true

  if (policy === 'ssr-required') {
    return { lazy: false, server, immediate: true }
  }

  if (policy === 'lazy-ok') {
    return { lazy: true, server: false, immediate: true }
  }

  return { lazy: true, server: false, immediate: false }
}
