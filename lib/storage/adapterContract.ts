/**
 * One contract, run against every implementation.
 *
 * The point of `StorageAdapter` is that callers cannot tell which backend they
 * have. A shared suite is the only way to keep that true: a backend that
 * diverges here has broken the abstraction, however well it works alone.
 *
 * Lives outside `__tests__` so jest does not collect it as an empty suite.
 */

import type { StorageAdapter } from './StorageAdapter';

export interface ContractOptions {
  /** Fresh, empty adapter per test. */
  readonly create: () => StorageAdapter | Promise<StorageAdapter>;
}

export function describeStorageAdapterContract(name: string, { create }: ContractOptions): void {
  describe(`${name} satisfies the StorageAdapter contract`, () => {
    let adapter: StorageAdapter;

    beforeEach(async () => {
      adapter = await create();
    });

    it('returns null for a key that was never set', async () => {
      await expect(adapter.getItem('missing')).resolves.toBeNull();
    });

    it('round trips a value', async () => {
      await adapter.setItem('key', 'value');
      await expect(adapter.getItem('key')).resolves.toBe('value');
    });

    it('overwrites an existing value', async () => {
      await adapter.setItem('key', 'first');
      await adapter.setItem('key', 'second');
      await expect(adapter.getItem('key')).resolves.toBe('second');
    });

    it('keeps keys independent', async () => {
      await adapter.setItem('a', '1');
      await adapter.setItem('b', '2');
      await expect(adapter.getItem('a')).resolves.toBe('1');
      await expect(adapter.getItem('b')).resolves.toBe('2');
    });

    it('removes a value', async () => {
      await adapter.setItem('key', 'value');
      await adapter.removeItem('key');
      await expect(adapter.getItem('key')).resolves.toBeNull();
    });

    it('treats removing a missing key as a no-op', async () => {
      await expect(adapter.removeItem('missing')).resolves.toBeUndefined();
    });

    it('clears everything', async () => {
      await adapter.setItem('a', '1');
      await adapter.setItem('b', '2');
      await adapter.clear();
      await expect(adapter.getItem('a')).resolves.toBeNull();
      await expect(adapter.getItem('b')).resolves.toBeNull();
    });

    it('stores an empty string as a value, distinct from absent', async () => {
      // A backend that conflates '' with null would break any caller that
      // stores an empty JSON array.
      await adapter.setItem('empty', '');
      await expect(adapter.getItem('empty')).resolves.toBe('');
    });

    it('preserves a serialized pattern-sized payload exactly', async () => {
      // Roughly the size of a real chart, to catch any truncation or encoding
      // mangling that a small value would hide.
      const payload = JSON.stringify({
        rows: Array.from({ length: 250 }, (_, y) =>
          Array.from({ length: 60 }, (_, i) => [i % 12, y % 7 === 0 ? 4 : 1]),
        ),
      });
      await adapter.setItem('pattern', payload);
      await expect(adapter.getItem('pattern')).resolves.toBe(payload);
    });

    it('preserves unicode and control characters', async () => {
      const value = 'DMC 310 \u2014 "Noir" \n\t\u00e9\u00fc\u4e2d\u6587\ud83e\uddf5';
      await adapter.setItem('unicode', value);
      await expect(adapter.getItem('unicode')).resolves.toBe(value);
    });

    it('accepts keys containing the separators the repositories use', async () => {
      await adapter.setItem('stitchmap:pattern:sample-1', 'value');
      await expect(adapter.getItem('stitchmap:pattern:sample-1')).resolves.toBe('value');
    });

    it('handles interleaved writes and reads', async () => {
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => adapter.setItem(`key-${i}`, `value-${i}`)),
      );
      const values = await Promise.all(
        Array.from({ length: 20 }, (_, i) => adapter.getItem(`key-${i}`)),
      );
      expect(values).toEqual(Array.from({ length: 20 }, (_, i) => `value-${i}`));
    });
  });
}
