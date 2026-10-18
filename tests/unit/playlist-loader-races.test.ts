import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { usePlaylists } from "../../composables/usePlaylists";
import type { Playlist } from "../../types/playlist";

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
});
function setup() {
  const requests: {
    signal: AbortSignal;
    resolve: (value: Playlist[]) => void;
    reject: (error: Error) => void;
  }[] = [];
  // Ignores abort to prove the stale-result guard, not just a cooperative network.
  vi.stubGlobal(
    "$fetch",
    vi.fn(
      (_url, options) =>
        new Promise((resolve, reject) =>
          requests.push({ signal: options.signal, resolve, reject }),
        ),
    ),
  );
  const scope = effectScope();
  scopes.push(scope);
  const model = scope.run(usePlaylists)!;
  return { requests, scope, model };
}
const playlist = (id: string) =>
  ({ playlistId: id, name: id, tracks: [] }) as unknown as Playlist;

describe("playlist picker loading ownership", () => {
  it.each(["success", "failure"])(
    "ignores obsolete %s while the reopened picker is still loading",
    async (outcome) => {
      const { model, requests } = setup();
      const first = model.fetchPlaylists();
      const second = model.fetchPlaylists();
      expect(requests[0]!.signal.aborted).toBe(true);
      if (outcome === "success") requests[0]!.resolve([playlist("old")]);
      else requests[0]!.reject(new Error("obsolete error"));
      await first;
      expect(model.loading.value).toBe(true);
      expect(model.error.value).toBeNull();
      expect(model.playlists.value).toEqual([]);
      requests[1]!.resolve([playlist("new")]);
      await second;
      expect(model.playlists.value.map((value) => value.playlistId)).toEqual([
        "new",
      ]);
      expect(model.loading.value).toBe(false);
    },
  );
  it("retains an honest error until retry and distinguishes an empty successful response", async () => {
    const { model, requests } = setup();
    const first = model.fetchPlaylists();
    requests[0]!.reject(new Error("Unauthorized"));
    await first;
    expect(model.error.value).toBeInstanceOf(Error);
    expect(model.loading.value).toBe(false);
    const retry = model.fetchPlaylists();
    expect(model.loading.value).toBe(true);
    expect(model.error.value).toBeNull();
    requests[1]!.resolve([]);
    await retry;
    expect(model.loading.value).toBe(false);
    expect(model.error.value).toBeNull();
    expect(model.playlists.value).toEqual([]);
  });
  it("aborts disposal and cannot publish a late response into the disposed view", async () => {
    const { model, requests, scope } = setup();
    const pending = model.fetchPlaylists();
    scope.stop();
    expect(requests[0]!.signal.aborted).toBe(true);
    requests[0]!.resolve([playlist("late")]);
    await pending;
    expect(model.playlists.value).toEqual([]);
  });
});
