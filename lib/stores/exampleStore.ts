// Canonical Zustand store pattern for StitchMap.
//
// Copy this file as the starting point for new stores. It demonstrates the
// conventions every store should follow:
//
//   1. Typed state and typed actions live in one interface (`ExampleState`).
//   2. State is mutated through the Immer middleware, so reducers can "mutate"
//      a draft while Zustand still receives an immutable update.
//   3. Persistence is wired through a `StorageAdapter`, so a store can be
//      persisted by swapping the adapter — no per-store boilerplate.
//
// Real persistence backends are deferred to a later sprint; the default
// adapter here keeps everything in memory so nothing survives a reload yet.

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { InMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';

export interface ExampleState {
  // State
  count: number;

  // Actions
  increment: () => void;
  decrement: () => void;
  incrementBy: (amount: number) => void;
  reset: () => void;
}

/** Storage key under which this store persists its state. */
export const EXAMPLE_STORE_NAME = 'example-store';

/**
 * Creates an `ExampleState` store bound to the given `StorageAdapter`.
 *
 * Exposed as a factory so tests (and future consumers) can inject an isolated
 * adapter. Application code should use the shared {@link useExampleStore}.
 */
export function createExampleStore(
  storageAdapter: StorageAdapter = new InMemoryStorageAdapter(),
): UseBoundStore<StoreApi<ExampleState>> {
  return create<ExampleState>()(
    persist(
      immer((set) => ({
        count: 0,
        increment: () =>
          set((state) => {
            state.count += 1;
          }),
        decrement: () =>
          set((state) => {
            state.count -= 1;
          }),
        incrementBy: (amount) =>
          set((state) => {
            state.count += amount;
          }),
        reset: () =>
          set((state) => {
            state.count = 0;
          }),
      })),
      {
        name: EXAMPLE_STORE_NAME,
        storage: createJSONStorage(() => storageAdapter),
      },
    ),
  );
}

/** Shared example store used by the app. */
export const useExampleStore = createExampleStore();
