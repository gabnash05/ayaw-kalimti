jest.mock('expo-crypto', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-sqlite', () => ({}));

import {
  clearProtectedLocalStorage,
  DATABASE_NAME,
  openEncryptedDatabase,
  ProtectedStorageInitializationError,
  ProtectedStorageRecoveryError,
} from './encrypted-database.js';
import { ProtectedStorageCleanupError } from './database-artifacts.js';
import { DATABASE_KEY_STORAGE_KEY } from './key-lifecycle.js';

const createDatabase = () => ({
  execAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest
    .fn()
    .mockImplementation((source: string) =>
      Promise.resolve(
        source === 'PRAGMA cipher_version;'
          ? { cipher_version: '4.7.0' }
          : null,
      ),
    ),
  closeAsync: jest.fn().mockResolvedValue(undefined),
});
const createDriver = () => ({
  openDatabaseAsync: jest.fn(),
});
const createStore = (value: string | null = null) => ({
  getItemAsync: jest.fn().mockResolvedValue(value),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
});
const createArtifacts = () => ({
  deleteAll: jest.fn().mockResolvedValue(undefined),
});
const randomBytes = {
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
};

describe('encrypted local database', () => {
  it('creates a protected key, verifies SQLCipher, and migrates transactionally', async () => {
    const database = createDatabase();
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, createArtifacts()),
    ).resolves.toBe(database);
    expect(driver.openDatabaseAsync).toHaveBeenCalledWith(DATABASE_NAME);
    expect(store.setItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
      '01'.repeat(32),
      { requireAuthentication: false },
    );
    expect(database.execAsync).toHaveBeenCalledWith(
      `PRAGMA key = "x'${'01'.repeat(32)}'";`,
    );
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'PRAGMA cipher_version;',
    );
    expect(database.execAsync).toHaveBeenCalledWith(
      'BEGIN IMMEDIATE TRANSACTION;',
    );
    expect(database.execAsync).toHaveBeenCalledWith('COMMIT;');
  });

  it('fails closed for an invalid protected key without opening plaintext storage', async () => {
    const driver = createDriver();
    const store = createStore('invalid');
    const artifacts = createArtifacts();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(driver.openDatabaseAsync).not.toHaveBeenCalled();
    expect(artifacts.deleteAll).toHaveBeenCalled();
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });

  it.each([null, { cipher_version: '' }, { cipher_version: '   ' }])(
    'rejects an unavailable SQLCipher runtime: %p',
    async (cipher) => {
      const database = createDatabase();
      database.getFirstAsync.mockResolvedValue(cipher);
      const driver = createDriver();
      driver.openDatabaseAsync.mockResolvedValue(database);
      const artifacts = createArtifacts();
      await expect(
        openEncryptedDatabase(
          driver,
          createStore('02'.repeat(32)),
          randomBytes,
          artifacts,
        ),
      ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
      expect(database.execAsync).not.toHaveBeenCalledWith(
        'BEGIN IMMEDIATE TRANSACTION;',
      );
      expect(database.closeAsync).toHaveBeenCalled();
      expect(artifacts.deleteAll).toHaveBeenCalled();
    },
  );

  it('does not reapply an already recorded migration after restart', async () => {
    const database = createDatabase();
    database.getFirstAsync.mockImplementation((source: string) =>
      Promise.resolve(
        source === 'PRAGMA cipher_version;'
          ? { cipher_version: '4.7.0' }
          : { version: 1 },
      ),
    );
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    await openEncryptedDatabase(
      driver,
      createStore('02'.repeat(32)),
      randomBytes,
      createArtifacts(),
    );
    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('local_saved_place_targets'),
    );
  });

  it('deletes unreadable local artifacts and their key after a database failure', async () => {
    const database = createDatabase();
    database.execAsync.mockRejectedValueOnce(new Error('key mismatch'));
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore('02'.repeat(32));
    const artifacts = createArtifacts();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(database.closeAsync).toHaveBeenCalled();
    expect(artifacts.deleteAll).toHaveBeenCalled();
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });

  it('surfaces a sanitized recovery error while attempting every cleanup step', async () => {
    const database = createDatabase();
    database.execAsync.mockRejectedValueOnce(new Error('key mismatch'));
    database.closeAsync.mockRejectedValueOnce(new Error('close failed'));
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore('02'.repeat(32));
    store.deleteItemAsync.mockRejectedValueOnce(new Error('key delete failed'));
    const artifacts = createArtifacts();
    artifacts.deleteAll.mockRejectedValueOnce(new Error('delete failed'));
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageRecoveryError);
    expect(database.closeAsync).toHaveBeenCalled();
    expect(artifacts.deleteAll).toHaveBeenCalled();
    expect(store.deleteItemAsync).toHaveBeenCalled();
  });

  it('clears database artifacts and key together on logout or deletion', async () => {
    const store = createStore();
    const artifacts = createArtifacts();
    await clearProtectedLocalStorage(store, artifacts);
    expect(artifacts.deleteAll).toHaveBeenCalled();
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });

  it('attempts key removal after artifact deletion fails', async () => {
    const store = createStore();
    const artifacts = createArtifacts();
    artifacts.deleteAll.mockRejectedValueOnce(new Error('delete failed'));
    await expect(
      clearProtectedLocalStorage(store, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageCleanupError);
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });
});
