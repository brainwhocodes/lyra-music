import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Ref } from 'vue';
import { useUser, type AppUser } from '../../composables/use-user';

const context = vi.hoisted(() => ({
  states: new Map<string, Ref<unknown>>(),
  request: vi.fn(),
}));
vi.mock('#imports', async () => {
  const vue = await import('vue');
  return {
    computed: vue.computed, readonly: vue.readonly,
    useRequestFetch: () => context.request,
    useState: (name: string, initial: () => unknown) => {
      if (!context.states.has(name)) context.states.set(name, vue.ref(initial()));
      return context.states.get(name);
    },
  };
});

const account = (id: string): AppUser => ({ userId: id, name: id, email: `${id}@example.test` });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => { context.states.clear(); context.request.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('shared Nuxt session ownership', () => {
  it('cannot restore an account after another composable caller clears the session', async () => {
    const result = deferred<AppUser>();
    context.request.mockReturnValueOnce(result.promise);
    const first = useUser(), second = useUser();
    const pending = first.fetchUser();
    second.clearUser();
    result.resolve(account('old'));
    expect(await pending).toBeNull();
    expect(first.user.value).toBeNull();
    expect(second.isAuthenticated.value).toBe(false);
  });

  it.each(['success', 'failure'])('does not replace a newer login after stale %s', async outcome => {
    const result = deferred<AppUser>();
    context.request.mockReturnValueOnce(result.promise);
    const session = useUser();
    const pending = session.fetchUser();
    useUser().setUserData(account('new'));
    if (outcome === 'success') result.resolve(account('old'));
    else result.reject(new Error('old unauthorized response'));
    expect(await pending).toEqual(account('new'));
    expect(session.user.value).toEqual(account('new'));
  });

  it.each(['success', 'failure'])('keeps the latest check after an older check reports %s', async outcome => {
    const old = deferred<AppUser>(), current = deferred<AppUser>();
    context.request.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const session = useUser();
    const first = session.fetchUser(), second = useUser().fetchUser();
    current.resolve(account('current'));
    await second;
    if (outcome === 'success') old.resolve(account('obsolete'));
    else old.reject(new Error('obsolete failure'));
    expect(await first).toEqual(account('current'));
    expect(session.userId.value).toBe('current');
  });

  it('invalidates a prior check as soon as logout begins', async () => {
    const result = deferred<AppUser>(), loggedOut = deferred<void>();
    context.request.mockReturnValueOnce(result.promise);
    vi.stubGlobal('$fetch', vi.fn(() => loggedOut.promise));
    const session = useUser();
    const check = session.fetchUser();
    const logout = session.logout();
    result.resolve(account('old'));
    expect(await check).toBeNull();
    loggedOut.resolve(); await logout;
    expect(session.user.value).toBeNull();
  });

  it('does not clear a newer login when an earlier logout response completes', async () => {
    const response = deferred<void>();
    vi.stubGlobal('$fetch', vi.fn(() => response.promise));
    const session = useUser();
    session.setUserData(account('old'));
    const logout = session.logout();
    useUser().setUserData(account('new'));
    response.resolve(); await logout;
    expect(session.user.value).toEqual(account('new'));
  });

  it.each(['before', 'after'])('a check during pending logout cannot preserve the old account when it resolves %s logout', async order => {
    const response = deferred<void>(), checkResponse = deferred<AppUser>();
    vi.stubGlobal('$fetch', vi.fn(() => response.promise));
    context.request.mockReturnValueOnce(checkResponse.promise);
    const session = useUser();
    session.setUserData(account('old'));
    const logout = session.logout();
    const check = useUser().fetchUser();
    if (order === 'before') {
      checkResponse.resolve(account('old')); await check;
      response.resolve(); await logout;
    } else {
      response.resolve(); await logout;
      checkResponse.resolve(account('old')); await check;
    }
    expect(session.user.value).toBeNull();
  });

  it('keeps sessions isolated across separate Nuxt request state maps', async () => {
    const first = useUser();
    first.setUserData(account('first'));
    context.states = new Map<string, Ref<unknown>>();
    const second = useUser();
    second.setUserData(account('second'));
    first.clearUser();
    expect(second.user.value).toEqual(account('second'));
    expect(first.user.value).toBeNull();
  });
});
