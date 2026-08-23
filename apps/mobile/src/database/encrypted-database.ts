import * as SQLite from 'expo-sqlite';

import {
  clearDatabaseKey,
  getOrCreateDatabaseKey,
  type KeyStore,
  type RandomBytes,
} from './key-lifecycle.js';
import { applyLocalMigrations, type SqlExecutor } from './migrations.js';

export const DATABASE_NAME = 'ayaw-kalimti.db';

export interface LocalDatabase extends SqlExecutor {
  closeAsync(): Promise<void>;
}

export interface DatabaseDriver {
  openDatabaseAsync(name: string): Promise<LocalDatabase>;
  deleteDatabaseAsync(name: string): Promise<void>;
}

const quoteKey = (key: string): string => `PRAGMA key = "x'${key}'";`;

export async function openEncryptedDatabase(
  driver: DatabaseDriver = SQLite,
  keyStore?: KeyStore,
  randomBytes?: RandomBytes,
): Promise<LocalDatabase> {
  let database: LocalDatabase | undefined;
  try {
    const key = await getOrCreateDatabaseKey(keyStore, randomBytes);
    database = await driver.openDatabaseAsync(DATABASE_NAME);
    await database.execAsync(quoteKey(key));
    await applyLocalMigrations(database);
    return database;
  } catch (error) {
    await database?.closeAsync().catch(() => undefined);
    await driver.deleteDatabaseAsync(DATABASE_NAME).catch(() => undefined);
    await clearDatabaseKey(keyStore).catch(() => undefined);
    throw error;
  }
}

export async function clearProtectedLocalStorage(
  driver: DatabaseDriver = SQLite,
  keyStore?: KeyStore,
): Promise<void> {
  const results = await Promise.allSettled([
    driver.deleteDatabaseAsync(DATABASE_NAME),
    clearDatabaseKey(keyStore),
  ]);
  const failedCleanup = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failedCleanup !== undefined) {
    throw failedCleanup.reason;
  }
}
