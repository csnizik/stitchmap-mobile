/**
 * Every `StorageAdapter` implementation is run through the same contract, plus
 * whatever is specific to that backend.
 *
 * MMKV is exercised through an injected fake rather than the native module,
 * which cannot load in jest. That verifies the adapter's translation layer, not
 * MMKV itself: the undefined-to-null conversion, and that each method maps to
 * the right MMKV call. Real device behaviour needs a development build.
 */
// react-native-mmkv v4 reaches into NitroModules at import time, which cannot
// load under jest. The adapter takes an injected store, so this mock only has
// to satisfy the import; every assertion runs against FakeMmkv below.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { describeStorageAdapterContract } from '../adapterContract';
import { IndexedDbStorageAdapter } from '../indexedDbStorageAdapter';
import { InMemoryStorageAdapter } from '../StorageAdapter';
import { MmkvStorageAdapter } from '../mmkvStorageAdapter';
import type { MmkvLike } from '../mmkvStorageAdapter';

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    throw new Error('createMMKV is unavailable in tests; inject a store instead');
  },
}));

/** Mirrors MMKV's synchronous API, including returning undefined for a miss. */
class FakeMmkv implements MmkvLike {
  readonly store = new Map<string, string>();

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.store.get(key);
  }

  remove(key: string): boolean {
    return this.store.delete(key);
  }

  clearAll(): void {
    this.store.clear();
  }
}

let databaseCounter = 0;

describeStorageAdapterContract('InMemoryStorageAdapter', {
  create: () => new InMemoryStorageAdapter(),
});

describeStorageAdapterContract('MmkvStorageAdapter', {
  create: () => new MmkvStorageAdapter({ storage: new FakeMmkv() }),
});

describeStorageAdapterContract('IndexedDbStorageAdapter', {
  create: () => {
    // A fresh factory and name per test, so nothing leaks between them.
    databaseCounter += 1;
    return new IndexedDbStorageAdapter({
      factory: new IDBFactory(),
      databaseName: `stitchmap-test-${databaseCounter}`,
    });
  },
});

describe('MmkvStorageAdapter specifics', () => {
  it('converts MMKV undefined into the contract null', async () => {
    const fake = new FakeMmkv();
    const adapter = new MmkvStorageAdapter({ storage: fake });
    expect(fake.getString('nope')).toBeUndefined();
    await expect(adapter.getItem('nope')).resolves.toBeNull();
  });

  it('writes through to the underlying store', async () => {
    const fake = new FakeMmkv();
    const adapter = new MmkvStorageAdapter({ storage: fake });
    await adapter.setItem('key', 'value');
    expect(fake.store.get('key')).toBe('value');
  });

  it('deletes from the underlying store', async () => {
    const fake = new FakeMmkv();
    const adapter = new MmkvStorageAdapter({ storage: fake });
    await adapter.setItem('key', 'value');
    await adapter.removeItem('key');
    expect(fake.store.has('key')).toBe(false);
  });

  it('clears the underlying store', async () => {
    const fake = new FakeMmkv();
    const adapter = new MmkvStorageAdapter({ storage: fake });
    await adapter.setItem('a', '1');
    await adapter.clear();
    expect(fake.store.size).toBe(0);
  });
});

describe('IndexedDbStorageAdapter specifics', () => {
  it('reuses one database handle across calls', async () => {
    const factory = new IDBFactory();
    const openSpy = jest.spyOn(factory, 'open');
    const adapter = new IndexedDbStorageAdapter({
      factory,
      databaseName: 'stitchmap-handle-reuse',
    });

    await adapter.setItem('a', '1');
    await adapter.getItem('a');
    await adapter.getItem('a');

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('persists across adapter instances backed by the same database', async () => {
    const factory = new IDBFactory();
    const name = 'stitchmap-persistence';

    const first = new IndexedDbStorageAdapter({ factory, databaseName: name });
    await first.setItem('key', 'survives');

    const second = new IndexedDbStorageAdapter({ factory, databaseName: name });
    await expect(second.getItem('key')).resolves.toBe('survives');
  });

  it('throws a useful error when IndexedDB is unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
    });

    try {
      expect(() => new IndexedDbStorageAdapter()).toThrow(/IndexedDB is not available/);
    } finally {
      if (original !== undefined) {
        Object.defineProperty(globalThis, 'indexedDB', original);
      }
    }
  });
});
