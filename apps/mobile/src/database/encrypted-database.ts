import * as SQLite from 'expo-sqlite';

import {
  DATABASE_NAME,
  expoDatabaseArtifactStore,
  ProtectedStorageCleanupError,
  type DatabaseArtifactStore,
} from './database-artifacts.js';
import {
  clearDatabaseKey,
  getOrCreateDatabaseKey,
  type KeyStore,
  type RandomBytes,
} from './key-lifecycle.js';
import { applyLocalMigrations, type SqlExecutor } from './migrations.js';

export { DATABASE_NAME } from './database-artifacts.js';

export interface LocalDatabase extends SqlExecutor {
  closeAsync(): Promise<void>;
}

export interface DatabaseDriver {
  openDatabaseAsync(name: string): Promise<LocalDatabase>;
}

const quoteKey = (key: string): string => `PRAGMA key = "x'${key}'";`;

export class ProtectedStorageInitializationError extends Error {
  public constructor() {
    super('Protected local storage could not be initialized.');
  }
}

export class ProtectedStorageRecoveryError extends Error {
  public constructor() {
    super('Protected local storage could not be recovered safely.');
  }
}

export class SqlCipherUnavailableError extends Error {
  public constructor() {
    super('SQLCipher is unavailable.');
  }
}

async function discardProtectedStorage(
  database: LocalDatabase | undefined,
  artifacts: DatabaseArtifactStore,
  keyStore: KeyStore | undefined,
): Promise<boolean> {
  let closeFailed = false;
  if (database !== undefined) {
    try {
      await database.closeAsync();
    } catch {
      closeFailed = true;
    }
  }

  return (await clearStorageArtifacts(artifacts, keyStore)) || closeFailed;
}

async function clearStorageArtifacts(
  artifacts: DatabaseArtifactStore,
  keyStore: KeyStore | undefined,
): Promise<boolean> {
  let failed = false;
  try {
    await artifacts.deleteAll();
  } catch {
    failed = true;
  }
  try {
    await clearDatabaseKey(keyStore);
  } catch {
    failed = true;
  }
  return failed;
}

export async function openEncryptedDatabase(
  driver: DatabaseDriver = SQLite,
  keyStore?: KeyStore,
  randomBytes?: RandomBytes,
  artifacts: DatabaseArtifactStore = expoDatabaseArtifactStore,
): Promise<LocalDatabase> {
  let database: LocalDatabase | undefined;
  try {
    const key = await getOrCreateDatabaseKey(keyStore, randomBytes);
    database = await driver.openDatabaseAsync(DATABASE_NAME);
    await database.execAsync(quoteKey(key));
    const cipher = await database.getFirstAsync<{ cipher_version: string }>(
      'PRAGMA cipher_version;',
    );
    if (cipher === null || cipher.cipher_version.trim() === '') {
      throw new SqlCipherUnavailableError();
    }
    await applyLocalMigrations(database);
    return database;
  } catch {
    const recoveryFailed = await discardProtectedStorage(
      database,
      artifacts,
      keyStore,
    );
    if (recoveryFailed) {
      throw new ProtectedStorageRecoveryError();
    }
    throw new ProtectedStorageInitializationError();
  }
}

export async function clearProtectedLocalStorage(
  keyStore?: KeyStore,
  artifacts: DatabaseArtifactStore = expoDatabaseArtifactStore,
): Promise<void> {
  if (await clearStorageArtifacts(artifacts, keyStore)) {
    throw new ProtectedStorageCleanupError();
  }
}
