import {
  clearProtectedLocalStorage,
  openEncryptedDatabase,
  type LocalDatabase,
} from './encrypted-database.js';
import { ProtectedStorageCleanupError } from './database-artifacts.js';

export type OpenProtectedStorage = () => Promise<LocalDatabase>;
export type ClearProtectedStorage = () => Promise<void>;

export class ProtectedStorageRuntime {
  private database: LocalDatabase | undefined;
  private initialization: Promise<LocalDatabase> | undefined;
  private cleanup: Promise<void> | undefined;

  public constructor(
    private readonly open: OpenProtectedStorage = openEncryptedDatabase,
    private readonly clearStorage: ClearProtectedStorage = clearProtectedLocalStorage,
  ) {}

  public initialize(): Promise<LocalDatabase> {
    if (this.database !== undefined) {
      return Promise.resolve(this.database);
    }
    if (this.initialization !== undefined) {
      return this.initialization;
    }
    if (this.cleanup !== undefined) {
      return this.cleanup.then(() => this.initialize());
    }

    const initialization = this.open();
    this.initialization = initialization;
    return initialization.then(
      (database) => {
        if (this.initialization === initialization) {
          this.database = database;
          this.initialization = undefined;
        }
        return database;
      },
      (error: unknown) => {
        if (this.initialization === initialization) {
          this.initialization = undefined;
        }
        throw error;
      },
    );
  }

  public clear(): Promise<void> {
    if (this.cleanup !== undefined) {
      return this.cleanup;
    }
    const cleanup = this.performClear();
    this.cleanup = cleanup;
    return cleanup.finally(() => {
      if (this.cleanup === cleanup) {
        this.cleanup = undefined;
      }
    });
  }

  private async performClear(): Promise<void> {
    if (this.initialization !== undefined) {
      try {
        await this.initialization;
      } catch {
        // Initialization already performs fail-closed cleanup.
      }
    }

    const database = this.database;
    this.database = undefined;
    this.initialization = undefined;

    let failed = false;
    if (database !== undefined) {
      try {
        await database.closeAsync();
      } catch {
        failed = true;
      }
    }
    try {
      await this.clearStorage();
    } catch {
      failed = true;
    }
    if (failed) {
      throw new ProtectedStorageCleanupError();
    }
  }
}

export const protectedStorageRuntime = new ProtectedStorageRuntime();
