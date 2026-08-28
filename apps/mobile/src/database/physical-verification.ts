import { clearDatabaseKey } from './key-lifecycle.js';
import {
  openEncryptedDatabase,
  type LocalDatabase,
} from './encrypted-database.js';
import {
  protectedStorageRuntime,
  type ProtectedStorageRuntime,
} from './runtime.js';

export const PRIVACY_PROBE_ORIGINAL = 'synthetic_storage_probe_original';
export const PRIVACY_PROBE_UPDATED = 'synthetic_storage_probe_updated';
const PRIVACY_PROBE_ID = 'synthetic-storage-probe';
const LOCKED_BACKGROUND_PROBE_ID = 'synthetic-locked-background-probe';
const LOCKED_BACKGROUND_PROBE_REASON = 'synthetic_locked_background_passed';
const PROBE_LIFETIME_MS = 60 * 60 * 1000;

export type LockedBackgroundProbeResult =
  'idle' | 'armed' | 'running' | 'passed' | 'failed';

export type LockedBackgroundProbeFailureStage =
  | 'none'
  | 'open'
  | 'write'
  | 'close'
  | 'foreground-open'
  | 'marker-read'
  | 'marker-missing'
  | 'marker-cleanup';

interface PhysicalStorageVerificationDependencies {
  openDatabase?: () => Promise<LocalDatabase>;
}

export class PhysicalStorageVerificationProbe {
  private transactionOpen = false;
  private lockedBackgroundResult: LockedBackgroundProbeResult = 'idle';
  private lockedBackgroundFailureStage: LockedBackgroundProbeFailureStage =
    'none';
  private lockedBackgroundAttempt: Promise<void> | undefined;
  private readonly openDatabase: () => Promise<LocalDatabase>;

  public constructor(
    private readonly runtime: ProtectedStorageRuntime = protectedStorageRuntime,
    private readonly removeKey: () => Promise<void> = clearDatabaseKey,
    private readonly now: () => number = Date.now,
    dependencies: PhysicalStorageVerificationDependencies = {},
  ) {
    this.openDatabase = dependencies.openDatabase ?? openEncryptedDatabase;
  }

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

  public async armLockedBackgroundAccess(): Promise<void> {
    if (this.lockedBackgroundResult === 'running') return;
    const database = await this.runtime.initialize();
    await database.execAsync(
      `DELETE FROM protected_diagnostics WHERE id = '${LOCKED_BACKGROUND_PROBE_ID}';`,
    );
    this.lockedBackgroundAttempt = undefined;
    this.lockedBackgroundResult = 'armed';
    this.lockedBackgroundFailureStage = 'none';
  }

  public getLockedBackgroundFailureStage(): LockedBackgroundProbeFailureStage {
    return this.lockedBackgroundFailureStage;
  }

  public async handleAppStateChange(
    appState: string,
  ): Promise<LockedBackgroundProbeResult> {
    if (
      appState === 'background' &&
      this.lockedBackgroundResult === 'armed' &&
      this.lockedBackgroundAttempt === undefined
    ) {
      this.lockedBackgroundResult = 'running';
      this.lockedBackgroundAttempt = this.runLockedBackgroundAccess();
    }

    if (this.lockedBackgroundAttempt !== undefined) {
      await this.lockedBackgroundAttempt;
    }
    if (
      appState === 'active' &&
      (this.lockedBackgroundResult === 'passed' ||
        this.lockedBackgroundResult === 'failed')
    ) {
      return this.consumeLockedBackgroundResult();
    }
    return this.lockedBackgroundResult;
  }

  private async runLockedBackgroundAccess(): Promise<void> {
    let database: LocalDatabase | undefined;
    try {
      database = await this.openDatabase();
    } catch {
      this.failLockedBackgroundAccess('open');
      return;
    }
    try {
      const occurredAt = this.now();
      await database.execAsync(
        `INSERT OR REPLACE INTO protected_diagnostics (id, reason_code, occurred_at_ms, expires_at_ms) VALUES ('${LOCKED_BACKGROUND_PROBE_ID}', '${LOCKED_BACKGROUND_PROBE_REASON}', ${occurredAt}, ${occurredAt + PROBE_LIFETIME_MS});`,
      );
      this.lockedBackgroundResult = 'passed';
    } catch {
      this.failLockedBackgroundAccess('write');
    } finally {
      try {
        await database.closeAsync();
      } catch {
        this.failLockedBackgroundAccess('close');
      }
    }
  }

  private async consumeLockedBackgroundResult(): Promise<'passed' | 'failed'> {
    let result: 'passed' | 'failed' =
      this.lockedBackgroundResult === 'passed' ? 'passed' : 'failed';
    let database: LocalDatabase;
    try {
      database = await this.runtime.initialize();
    } catch {
      this.failLockedBackgroundAccess('foreground-open');
      return this.finishLockedBackgroundAccess('failed');
    }

    try {
      const marker = await database.getFirstAsync<{ reason_code: string }>(
        `SELECT reason_code FROM protected_diagnostics WHERE id = '${LOCKED_BACKGROUND_PROBE_ID}';`,
      );
      if (marker?.reason_code !== LOCKED_BACKGROUND_PROBE_REASON) {
        result = 'failed';
        this.failLockedBackgroundAccess('marker-missing');
      }
    } catch {
      result = 'failed';
      this.failLockedBackgroundAccess('marker-read');
    }

    try {
      await database.execAsync(
        `DELETE FROM protected_diagnostics WHERE id = '${LOCKED_BACKGROUND_PROBE_ID}';`,
      );
    } catch {
      result = 'failed';
      this.failLockedBackgroundAccess('marker-cleanup');
    }

    return this.finishLockedBackgroundAccess(result);
  }

  private failLockedBackgroundAccess(
    stage: Exclude<LockedBackgroundProbeFailureStage, 'none'>,
  ): void {
    if (this.lockedBackgroundFailureStage === 'none') {
      this.lockedBackgroundFailureStage = stage;
    }
    this.lockedBackgroundResult = 'failed';
  }

  private finishLockedBackgroundAccess(
    result: 'passed' | 'failed',
  ): 'passed' | 'failed' {
    this.lockedBackgroundAttempt = undefined;
    this.lockedBackgroundResult = 'idle';
    return result;
  }
}

export const physicalStorageVerificationProbe =
  new PhysicalStorageVerificationProbe();
