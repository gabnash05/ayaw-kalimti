jest.mock('expo-crypto', () => ({}));
jest.mock('expo-secure-store', () => ({}));

import {
  DATABASE_KEY_STORAGE_KEY,
  getOrCreateDatabaseKey,
  InvalidGeneratedDatabaseKeyError,
  InvalidStoredDatabaseKeyError,
} from './key-lifecycle.js';

const createStore = (value: string | null = null) => ({
  getItemAsync: jest.fn().mockResolvedValue(value),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
});

describe('database key lifecycle', () => {
  it('reuses a valid stored key without generating another', async () => {
    const store = createStore('ab'.repeat(32));
    const random = { getRandomBytesAsync: jest.fn() };
    await expect(getOrCreateDatabaseKey(store, random)).resolves.toBe(
      'ab'.repeat(32),
    );
    expect(random.getRandomBytesAsync).not.toHaveBeenCalled();
  });

  it('rejects malformed stored key material', async () => {
    await expect(
      getOrCreateDatabaseKey(createStore('invalid'), {
        getRandomBytesAsync: jest.fn(),
      }),
    ).rejects.toBeInstanceOf(InvalidStoredDatabaseKeyError);
  });

  it('rejects random output that is not exactly 32 bytes', async () => {
    const store = createStore();
    await expect(
      getOrCreateDatabaseKey(store, {
        getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(31)),
      }),
    ).rejects.toBeInstanceOf(InvalidGeneratedDatabaseKeyError);
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  it('stores a generated key without interactive authentication', async () => {
    const store = createStore();
    await getOrCreateDatabaseKey(store, {
      getRandomBytesAsync: jest
        .fn()
        .mockResolvedValue(new Uint8Array(32).fill(255)),
    });
    expect(store.setItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
      'ff'.repeat(32),
      { requireAuthentication: false },
    );
  });
});
