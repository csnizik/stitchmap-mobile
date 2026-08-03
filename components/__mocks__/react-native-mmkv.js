/**
 * Automatic mock for react-native-mmkv.
 *
 * v4 reaches into NitroModules at import time, which cannot load under jest.
 * Any module that transitively imports the storage layer would otherwise fail
 * to load, which is most of the app once RepositoryProvider is in the tree.
 *
 * Jest applies mocks in a root `__mocks__` directory to node modules
 * automatically, so no jest.mock() call is needed. Tests that want to assert
 * on MMKV behaviour specifically still declare their own factory, which takes
 * precedence over this one.
 *
 * The store is in-memory and per-instance, mirroring the real API closely
 * enough that code under test behaves the same.
 */

class FakeMMKV {
  constructor() {
    this.store = new Map();
  }

  set(key, value) {
    this.store.set(key, value);
  }

  getString(key) {
    return this.store.get(key);
  }

  remove(key) {
    return this.store.delete(key);
  }

  clearAll() {
    this.store.clear();
  }
}

const createMMKV = () => new FakeMMKV();

module.exports = { createMMKV };
