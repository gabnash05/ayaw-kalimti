jest.mock('expo-crypto', () => ({}));
jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-sqlite', () => ({}));

import {
  clearProtectedLocalStorage,
  DATABASE_NAME,
  openEncryptedDatabase,
} from './encrypted-database.js';
import {
  DATABASE_KEY_STORAGE_KEY,
  InvalidStoredDatabaseKeyError,
} from './key-lifecycle.js';

const createDatabase = () => ({
  execAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  closeAsync: jest.fn().mockResolvedValue(undefined),
});
const createDriver = () => ({
  openDatabaseAsync: jest.fn(),
  deleteDatabaseAsync: jest.fn().mockResolvedValue(undefined),
});
const createStore = (value: string | null = null) => ({
  getItemAsync: jest.fn().mockResolvedValue(value),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
});
const randomBytes = {
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
};

describe('encrypted local database', () => {
  it('creates a protected key, configures SQLCipher, and migrates transactionally', async () => {
    const database = createDatabase();
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes),
    ).resolves.toBe(database);
    expect(store.setItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
      '01'.repeat(32),
      { requireAuthentication: false },
    );
    expect(database.execAsync).toHaveBeenCalledWith(
      `PRAGMA key = "x'${'01'.repeat(32)}'";`,
    );
    expect(database.execAsync).toHaveBeenCalledWith(
      'BEGIN IMMEDIATE TRANSACTION;',
    );
    expect(database.execAsync).toHaveBeenCalledWith('COMMIT;');
  });

  it('fails closed for an invalid protected key without a plaintext fallback', async () => {
    const driver = createDriver();
    const store = createStore('invalid');
    await expect(
      openEncryptedDatabase(driver, store, randomBytes),
    ).rejects.toBeInstanceOf(InvalidStoredDatabaseKeyError);
    expect(driver.openDatabaseAsync).not.toHaveBeenCalled();
    expect(driver.deleteDatabaseAsync).toHaveBeenCalledWith(DATABASE_NAME);
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });

  it('does not reapply an already recorded migration after restart', async () => {
    const database = createDatabase();
    database.getFirstAsync.mockResolvedValue({ version: 1 });
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    await openEncryptedDatabase(
      driver,
      createStore('02'.repeat(32)),
      randomBytes,
    );
    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('local_saved_place_targets'),
    );
  });

  it('deletes unreadable local data and its key after a database failure', async () => {
    const database = createDatabase();
    database.execAsync.mockRejectedValueOnce(new Error('key mismatch'));
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore('02'.repeat(32));
    await expect(
      openEncryptedDatabase(driver, store, randomBytes),
    ).rejects.toThrow('key mismatch');
    expect(database.closeAsync).toHaveBeenCalled();
    expect(driver.deleteDatabaseAsync).toHaveBeenCalledWith(DATABASE_NAME);
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });

  it('clears database and key together on logout or deletion', async () => {
    const driver = createDriver();
    const store = createStore();
    await clearProtectedLocalStorage(driver, store);
    expect(driver.deleteDatabaseAsync).toHaveBeenCalledWith(DATABASE_NAME);
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });

  it('attempts both cleanup steps and reports a deletion failure', async () => {
    const driver = createDriver();
    driver.deleteDatabaseAsync.mockRejectedValueOnce(
      new Error('delete failed'),
    );
    const store = createStore();
    await expect(clearProtectedLocalStorage(driver, store)).rejects.toThrow(
      'delete failed',
    );
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });
});
