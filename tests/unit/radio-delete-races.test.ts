import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useRadioStationDeletion } from '../../composables/useRadioStationDeletion';

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));

function setup() {
  const selected = ref<{ channelId: string } | null>({ channelId: 'a' });
  const open = ref(true);
  const pending: { id: string; resolve: () => void; reject: (error: unknown) => void }[] = [];
  const remove = vi.fn((id: string) => new Promise<void>((resolve, reject) => pending.push({ id, resolve, reject })));
  const refresh = vi.fn(async () => {});
  const scope = effectScope(); scopes.push(scope);
  const deletion = scope.run(() => useRadioStationDeletion(selected, open, remove, refresh))!;
  return { selected, open, pending, refresh, scope, ...deletion };
}

describe('radio deletion confirmation ownership', () => {
  it('cannot close a later station confirmation or clear its pending state', async () => {
    const context = setup();
    const first = context.deleteStation();
    context.open.value = false;
    context.selected.value = { channelId: 'b' };
    context.open.value = true;
    const second = context.deleteStation();
    expect(context.pending.map(request => request.id)).toEqual(['a', 'b']);
    context.pending[0].resolve(); await first;
    expect(context.open.value).toBe(true);
    expect(context.deleting.value).toBe(true);
    expect(context.status.value).toBe('');
    expect(context.refresh).toHaveBeenCalledTimes(1);
    context.pending[1].resolve(); await second;
    expect(context.open.value).toBe(false);
    expect(context.deleting.value).toBe(false);
    expect(context.status.value).toBe('Station deleted.');
  });

  it('ignores an old failure after the same station confirmation is reopened', async () => {
    const context = setup();
    const first = context.deleteStation();
    context.open.value = false; context.open.value = true;
    context.pending[0].reject(new Error('Old failure')); await first;
    expect(context.open.value).toBe(true);
    expect(context.deleteError.value).toBe('');
    expect(context.deleting.value).toBe(false);
  });

  it('keeps current failures visible and supports retry without duplicate submission', async () => {
    const context = setup();
    const first = context.deleteStation();
    await context.deleteStation();
    expect(context.pending).toHaveLength(1);
    context.pending[0].reject(new Error('Network failure')); await first;
    expect(context.open.value).toBe(true);
    expect(context.deleteError.value).toContain('Please try again');
    const retry = context.deleteStation();
    expect(context.deleteError.value).toBe('');
    context.pending[1].resolve(); await retry;
    expect(context.open.value).toBe(false);
  });

  it('does not refresh or alter a disposed page after mutation completion', async () => {
    const context = setup();
    const first = context.deleteStation();
    context.scope.stop();
    context.pending[0].resolve(); await first;
    expect(context.refresh).not.toHaveBeenCalled();
    expect(context.open.value).toBe(true);
    expect(context.status.value).toBe('');
    await context.deleteStation();
    expect(context.pending).toHaveLength(1);
  });
});
