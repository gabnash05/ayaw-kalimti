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
  InvalidStoredDatabaseKeyError,
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
const SQLITE_CORRUPT = 11;
const SQLITE_NOTADB = 26;
const SQLITE_ERROR_CODE = /(?:^|\s)Error code (\d+):/;
const EXPO_SQLITE_ERROR_CODE = 'ERR_INTERNAL_SQLITE_ERROR';
const SQLITE_UNRECOVERABLE_MESSAGES = [
  'database disk image is malformed',
  'file is not a database',
] as const;

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
  const closeFailed = await closeDatabase(database);
  return (await clearStorageArtifacts(artifacts, keyStore)) || closeFailed;
}

async function closeDatabase(
  database: LocalDatabase | undefined,
): Promise<boolean> {
  if (database === undefined) return false;
  try {
    await database.closeAsync();
    return false;
  } catch {
    return true;
  }
}

function hasUnrecoverableSqliteDiagnosis(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const match = SQLITE_ERROR_CODE.exec(error.message);
  if (match !== null) {
    const code = Number(match[1]);
    return code === SQLITE_CORRUPT || code === SQLITE_NOTADB;
  }

  const code = (error as Error & { code?: unknown }).code;
  if (code !== EXPO_SQLITE_ERROR_CODE) return false;
  return SQLITE_UNRECOVERABLE_MESSAGES.some(
    (message) =>
      error.message === message || error.message.endsWith(`: ${message}`),
  );
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
  let databaseExisted: boolean;
  let openAttempted = false;
  let keyApplied = false;

  try {
    databaseExisted = await artifacts.databaseExists();
  } catch {
    throw new ProtectedStorageInitializationError();
  }

  try {
    const key = await getOrCreateDatabaseKey(keyStore, randomBytes);
    openAttempted = true;
    database = await driver.openDatabaseAsync(DATABASE_NAME);
    await database.execAsync(quoteKey(key));
    keyApplied = true;
    const cipher = await database.getFirstAsync<{ cipher_version: string }>(
      'PRAGMA cipher_version;',
    );
    if (cipher === null || cipher.cipher_version.trim() === '') {
      throw new SqlCipherUnavailableError();
    }
    await applyLocalMigrations(database);
    return database;
  } catch (error) {
    const discard =
      error instanceof InvalidStoredDatabaseKeyError ||
      (keyApplied && hasUnrecoverableSqliteDiagnosis(error)) ||
      (!databaseExisted && openAttempted);

    if (discard) {
      const recoveryFailed = await discardProtectedStorage(
        database,
        artifacts,
        keyStore,
      );
      if (recoveryFailed) {
        throw new ProtectedStorageRecoveryError();
      }
    } else if (await closeDatabase(database)) {
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
