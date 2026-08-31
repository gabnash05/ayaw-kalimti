jest.mock('expo-crypto', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-sqlite', () => ({}));

import { ProtectedStorageCleanupError } from './database-artifacts.js';
import { ProtectedStorageRuntime } from './runtime.js';

const createDatabase = () => ({
  execAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  closeAsync: jest.fn().mockResolvedValue(undefined),
});

describe('protected storage runtime', () => {
  it('shares one initialization across concurrent callers', async () => {
    const database = createDatabase();
    const open = jest.fn().mockResolvedValue(database);
    const runtime = new ProtectedStorageRuntime(open, jest.fn());
    await expect(
      Promise.all([runtime.initialize(), runtime.initialize()]),
    ).resolves.toEqual([database, database]);
    await expect(runtime.initialize()).resolves.toBe(database);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('allows an explicit retry after initialization fails', async () => {
    const database = createDatabase();
    const open = jest
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(database);
    const runtime = new ProtectedStorageRuntime(open, jest.fn());
    await expect(runtime.initialize()).rejects.toThrow('unavailable');
    await expect(runtime.initialize()).resolves.toBe(database);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('closes the active database before clearing its artifacts and key', async () => {
    const order: string[] = [];
    const database = createDatabase();
    database.closeAsync.mockImplementation(() => {
      order.push('close');
      return Promise.resolve();
    });
    const clear = jest.fn().mockImplementation(() => {
      order.push('clear');
      return Promise.resolve();
    });
    const runtime = new ProtectedStorageRuntime(
      jest.fn().mockResolvedValue(database),
      clear,
    );
    await runtime.initialize();
    await runtime.clear();
    expect(order).toEqual(['close', 'clear']);
  });

  it('still clears artifacts and key when closing the live handle fails', async () => {
    const database = createDatabase();
    database.closeAsync.mockRejectedValueOnce(new Error('close failed'));
    const clear = jest.fn().mockResolvedValue(undefined);
    const runtime = new ProtectedStorageRuntime(
      jest.fn().mockResolvedValue(database),
      clear,
    );
    await runtime.initialize();
    await expect(runtime.clear()).rejects.toBeInstanceOf(
      ProtectedStorageCleanupError,
    );
    expect(clear).toHaveBeenCalled();
  });

  it('deduplicates concurrent cleanup calls', async () => {
    const clear = jest.fn().mockResolvedValue(undefined);
    const runtime = new ProtectedStorageRuntime(jest.fn(), clear);
    await Promise.all([runtime.clear(), runtime.clear()]);
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
