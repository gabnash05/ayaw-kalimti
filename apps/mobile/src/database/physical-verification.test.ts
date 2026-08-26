jest.mock('expo-crypto', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-sqlite', () => ({}));

import {
  PhysicalStorageVerificationProbe,
  PRIVACY_PROBE_ORIGINAL,
  PRIVACY_PROBE_UPDATED,
} from './physical-verification.js';
import type { ProtectedStorageRuntime } from './runtime.js';

const createHarness = () => {
  const database = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
  const clear = jest.fn().mockResolvedValue(undefined);
  const runtime = {
    initialize: jest.fn().mockResolvedValue(database),
    clear,
  } as unknown as ProtectedStorageRuntime;
  const removeKey = jest.fn().mockResolvedValue(undefined);
  return {
    database,
    clear,
    runtime,
    removeKey,
    probe: new PhysicalStorageVerificationProbe(runtime, removeKey, () => 1000),
  };
};

describe('physical storage verification probe', () => {
  it('holds a transaction containing only fixed synthetic canaries', async () => {
    const { database, probe } = createHarness();
    await probe.holdJournalTransaction();
    const statements = (database.execAsync.mock.calls as Array<[string]>).map(
      ([source]) => source,
    );
    expect(statements).toEqual(
      expect.arrayContaining([
        expect.stringContaining(PRIVACY_PROBE_ORIGINAL),
        'BEGIN IMMEDIATE TRANSACTION;',
        expect.stringContaining(PRIVACY_PROBE_UPDATED),
      ]),
    );
  });

  it('does not open a second held transaction', async () => {
    const { database, probe } = createHarness();
    await probe.holdJournalTransaction();
    await probe.holdJournalTransaction();
    expect(
      database.execAsync.mock.calls.filter(
        ([source]) => source === 'BEGIN IMMEDIATE TRANSACTION;',
      ),
    ).toHaveLength(1);
  });

  it('rolls back a failed probe update', async () => {
    const { database, probe } = createHarness();
    database.execAsync.mockImplementation((source: string) => {
      if (source.includes(PRIVACY_PROBE_UPDATED)) {
        return Promise.reject(new Error('update failed'));
      }
      return Promise.resolve();
    });
    await expect(probe.holdJournalTransaction()).rejects.toThrow(
      'update failed',
    );
    expect(database.execAsync).toHaveBeenCalledWith('ROLLBACK;');
  });

  it('rolls back before invalidating only the database key', async () => {
    const { database, probe, removeKey } = createHarness();
    await probe.holdJournalTransaction();
    await probe.invalidateKey();
    expect(database.execAsync).toHaveBeenCalledWith('ROLLBACK;');
    expect(removeKey).toHaveBeenCalledTimes(1);
  });

  it('rolls back before invoking complete protected cleanup', async () => {
    const { clear, database, probe } = createHarness();
    await probe.holdJournalTransaction();
    await probe.clearProtectedStorage();
    expect(database.execAsync).toHaveBeenCalledWith('ROLLBACK;');
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
