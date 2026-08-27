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
const createArtifacts = (databaseExists = true) => ({
  databaseExists: jest.fn().mockResolvedValue(databaseExists),
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
    'preserves existing storage when SQLCipher is unavailable: %p',
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
      expect(artifacts.deleteAll).not.toHaveBeenCalled();
    },
  );

  it('cleans an empty database created before first-install initialization fails', async () => {
    const database = createDatabase();
    database.getFirstAsync.mockResolvedValue(null);
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore();
    const artifacts = createArtifacts(false);
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(artifacts.deleteAll).toHaveBeenCalled();
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });

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

  it.each([
    ['corrupt', 11, 'database disk image is malformed'],
    ['not a database', 26, 'file is not a database'],
  ])(
    'deletes storage after confirmed SQLite %s diagnosis',
    async (_label, code, message) => {
      const database = createDatabase();
      database.getFirstAsync.mockImplementation((source: string) =>
        source === 'PRAGMA cipher_version;'
          ? Promise.resolve({ cipher_version: '4.7.0' })
          : Promise.reject(new Error(`Error code ${code}: ${message}`)),
      );
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
    },
  );

  it('cleans a missing-key database after the replacement key confirms mismatch', async () => {
    const database = createDatabase();
    database.getFirstAsync.mockImplementation((source: string) =>
      source === 'PRAGMA cipher_version;'
        ? Promise.resolve({ cipher_version: '4.7.0' })
        : Promise.reject(new Error('Error code 26: file is not a database')),
    );
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore();
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
    database.getFirstAsync.mockImplementation((source: string) =>
      source === 'PRAGMA cipher_version;'
        ? Promise.resolve({ cipher_version: '4.7.0' })
        : Promise.reject(new Error('Error code 11: database is malformed')),
    );
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

  it('preserves storage after a transient SecureStore failure', async () => {
    const driver = createDriver();
    const store = createStore();
    store.getItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));
    const artifacts = createArtifacts();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(driver.openDatabaseAsync).not.toHaveBeenCalled();
    expect(artifacts.deleteAll).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('preserves existing storage after a transient database-open failure', async () => {
    const driver = createDriver();
    driver.openDatabaseAsync.mockRejectedValueOnce(new Error('database busy'));
    const store = createStore('02'.repeat(32));
    const artifacts = createArtifacts();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(artifacts.deleteAll).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('cleans possible empty artifacts after a first-install open failure', async () => {
    const driver = createDriver();
    driver.openDatabaseAsync.mockRejectedValueOnce(new Error('open failed'));
    const store = createStore();
    const artifacts = createArtifacts(false);
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(artifacts.deleteAll).toHaveBeenCalled();
    expect(store.deleteItemAsync).toHaveBeenCalledWith(
      DATABASE_KEY_STORAGE_KEY,
    );
  });

  it('preserves existing storage after an unclassified migration failure', async () => {
    const database = createDatabase();
    database.execAsync.mockImplementation((source: string) =>
      source.includes('CREATE TABLE local_saved_place_targets')
        ? Promise.reject(new Error('Error code 1: migration failed'))
        : Promise.resolve(),
    );
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore('02'.repeat(32));
    const artifacts = createArtifacts();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(database.execAsync).toHaveBeenCalledWith('ROLLBACK;');
    expect(database.closeAsync).toHaveBeenCalled();
    expect(artifacts.deleteAll).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('preserves existing storage when migration rollback also fails', async () => {
    const database = createDatabase();
    database.execAsync.mockImplementation((source: string) => {
      if (source.includes('CREATE TABLE local_saved_place_targets')) {
        return Promise.reject(new Error('migration failed'));
      }
      if (source === 'ROLLBACK;') {
        return Promise.reject(new Error('rollback failed'));
      }
      return Promise.resolve();
    });
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore('02'.repeat(32));
    const artifacts = createArtifacts();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(database.closeAsync).toHaveBeenCalled();
    expect(artifacts.deleteAll).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('fails safely without opening storage when artifact state is unavailable', async () => {
    const driver = createDriver();
    const store = createStore('02'.repeat(32));
    const artifacts = createArtifacts();
    artifacts.databaseExists.mockRejectedValueOnce(
      new Error('artifact state unavailable'),
    );
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageInitializationError);
    expect(driver.openDatabaseAsync).not.toHaveBeenCalled();
    expect(artifacts.deleteAll).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('reports recovery failure without deleting data when a transient handle cannot close', async () => {
    const database = createDatabase();
    database.getFirstAsync.mockResolvedValue(null);
    database.closeAsync.mockRejectedValueOnce(new Error('close failed'));
    const driver = createDriver();
    driver.openDatabaseAsync.mockResolvedValue(database);
    const store = createStore('02'.repeat(32));
    const artifacts = createArtifacts();
    await expect(
      openEncryptedDatabase(driver, store, randomBytes, artifacts),
    ).rejects.toBeInstanceOf(ProtectedStorageRecoveryError);
    expect(artifacts.deleteAll).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
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
