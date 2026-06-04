import { createExampleStore } from '../exampleStore';
import { InMemoryStorageAdapter } from '../../storage/StorageAdapter';

describe('exampleStore', () => {
  it('initializes count at zero', () => {
    const useStore = createExampleStore(new InMemoryStorageAdapter());

    expect(useStore.getState().count).toBe(0);
  });

  it('increments and decrements the count', () => {
    const useStore = createExampleStore(new InMemoryStorageAdapter());

    useStore.getState().increment();
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(2);

    useStore.getState().decrement();
    expect(useStore.getState().count).toBe(1);
  });

  it('increments by an arbitrary amount', () => {
    const useStore = createExampleStore(new InMemoryStorageAdapter());

    useStore.getState().incrementBy(5);
    expect(useStore.getState().count).toBe(5);
  });

  it('resets the count back to zero', () => {
    const useStore = createExampleStore(new InMemoryStorageAdapter());

    useStore.getState().incrementBy(10);
    expect(useStore.getState().count).toBe(10);

    useStore.getState().reset();
    expect(useStore.getState().count).toBe(0);
  });

  it('produces a new state object on each update (immutability)', () => {
    const useStore = createExampleStore(new InMemoryStorageAdapter());

    const before = useStore.getState();
    before.increment();
    const after = useStore.getState();

    expect(after).not.toBe(before);
    expect(before.count).toBe(0);
    expect(after.count).toBe(1);
  });

  it('keeps separate store instances isolated', () => {
    const storeA = createExampleStore(new InMemoryStorageAdapter());
    const storeB = createExampleStore(new InMemoryStorageAdapter());

    storeA.getState().incrementBy(3);

    expect(storeA.getState().count).toBe(3);
    expect(storeB.getState().count).toBe(0);
  });
});
