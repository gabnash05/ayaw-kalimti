import { clearDatabaseKey } from './key-lifecycle.js';
import {
  protectedStorageRuntime,
  type ProtectedStorageRuntime,
} from './runtime.js';

export const PRIVACY_PROBE_ORIGINAL = 'synthetic_storage_probe_original';
export const PRIVACY_PROBE_UPDATED = 'synthetic_storage_probe_updated';
const PRIVACY_PROBE_ID = 'synthetic-storage-probe';
const PROBE_LIFETIME_MS = 60 * 60 * 1000;

export class PhysicalStorageVerificationProbe {
  private transactionOpen = false;

  public constructor(
    private readonly runtime: ProtectedStorageRuntime = protectedStorageRuntime,
    private readonly removeKey: () => Promise<void> = clearDatabaseKey,
    private readonly now: () => number = Date.now,
  ) {}

  public async holdJournalTransaction(): Promise<void> {
    if (this.transactionOpen) return;
    const database = await this.runtime.initialize();
    const occurredAt = this.now();
    const expiresAt = occurredAt + PROBE_LIFETIME_MS;
    await database.execAsync(
      `INSERT OR REPLACE INTO protected_diagnostics (id, reason_code, occurred_at_ms, expires_at_ms) VALUES ('${PRIVACY_PROBE_ID}', '${PRIVACY_PROBE_ORIGINAL}', ${occurredAt}, ${expiresAt});`,
    );
    await database.execAsync('BEGIN IMMEDIATE TRANSACTION;');
    try {
      await database.execAsync(
        `UPDATE protected_diagnostics SET reason_code = '${PRIVACY_PROBE_UPDATED}' WHERE id = '${PRIVACY_PROBE_ID}';`,
      );
      this.transactionOpen = true;
    } catch (error) {
      await database.execAsync('ROLLBACK;').catch(() => undefined);
      throw error;
    }
  }

  public async rollbackJournalTransaction(): Promise<void> {
    if (!this.transactionOpen) return;
    const database = await this.runtime.initialize();
    await database.execAsync('ROLLBACK;');
    this.transactionOpen = false;
    await database.execAsync(
      `DELETE FROM protected_diagnostics WHERE id = '${PRIVACY_PROBE_ID}';`,
    );
  }

  public async invalidateKey(): Promise<void> {
    await this.rollbackJournalTransaction();
    await this.removeKey();
  }

  public async clearProtectedStorage(): Promise<void> {
    await this.rollbackJournalTransaction();
    await this.runtime.clear();
  }
}

export const physicalStorageVerificationProbe =
  new PhysicalStorageVerificationProbe();
