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

const createLockedBackgroundHarness = () => {
  const harness = createHarness();
  const backgroundDatabase = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
  const openDatabase = jest.fn().mockResolvedValue(backgroundDatabase);
  const sleep = jest.fn().mockResolvedValue(undefined);
  return {
    ...harness,
    backgroundDatabase,
    openDatabase,
    sleep,
    probe: new PhysicalStorageVerificationProbe(
      harness.runtime,
      harness.removeKey,
      () => 1000,
      { openDatabase, sleep },
    ),
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

  it('opens and closes protected storage while backgrounded and consumes its marker', async () => {
    const { backgroundDatabase, database, openDatabase, probe, sleep } =
      createLockedBackgroundHarness();
    database.getFirstAsync.mockResolvedValue({
      reason_code: 'synthetic_locked_background_passed',
    });

    await probe.armLockedBackgroundAccess();
    await expect(probe.handleAppStateChange('background')).resolves.toBe(
      'passed',
    );
    await expect(probe.handleAppStateChange('active')).resolves.toBe('passed');

    expect(sleep).toHaveBeenCalledWith(1000);
    expect(openDatabase).toHaveBeenCalledTimes(1);
    expect(backgroundDatabase.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('synthetic_locked_background_passed'),
    );
    expect(backgroundDatabase.closeAsync).toHaveBeenCalledTimes(1);
    expect(database.execAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        "DELETE FROM protected_diagnostics WHERE id = 'synthetic-locked-background-probe'",
      ),
    );
  });

  it('shares one locked-background attempt across duplicate background events', async () => {
    const harness = createLockedBackgroundHarness();
    let finishSleep: (() => void) | undefined;
    harness.sleep.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSleep = resolve;
        }),
    );
    await harness.probe.armLockedBackgroundAccess();

    const first = harness.probe.handleAppStateChange('background');
    const duplicate = harness.probe.handleAppStateChange('background');
    expect(harness.openDatabase).not.toHaveBeenCalled();
    finishSleep?.();
    await Promise.all([first, duplicate]);

    expect(harness.openDatabase).toHaveBeenCalledTimes(1);
  });

  it('fails without opening storage when the app returns active before the delay', async () => {
    const harness = createLockedBackgroundHarness();
    let finishSleep: (() => void) | undefined;
    harness.sleep.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSleep = resolve;
        }),
    );
    await harness.probe.armLockedBackgroundAccess();

    const background = harness.probe.handleAppStateChange('background');
    const active = harness.probe.handleAppStateChange('active');
    finishSleep?.();

    await background;
    await expect(active).resolves.toBe('failed');
    expect(harness.openDatabase).not.toHaveBeenCalled();
  });

  it('reports a sanitized failure when the background database cannot open', async () => {
    const harness = createLockedBackgroundHarness();
    harness.openDatabase.mockRejectedValueOnce(
      new Error('sensitive native failure'),
    );
    await harness.probe.armLockedBackgroundAccess();

    await expect(
      harness.probe.handleAppStateChange('background'),
    ).resolves.toBe('failed');
    await expect(harness.probe.handleAppStateChange('active')).resolves.toBe(
      'failed',
    );
  });

  it('reports a sanitized failure when the background delay cannot complete', async () => {
    const harness = createLockedBackgroundHarness();
    harness.sleep.mockRejectedValueOnce(new Error('timer unavailable'));
    await harness.probe.armLockedBackgroundAccess();

    await expect(
      harness.probe.handleAppStateChange('background'),
    ).resolves.toBe('failed');
    expect(harness.openDatabase).not.toHaveBeenCalled();
  });

  it('fails verification when the background connection cannot close', async () => {
    const harness = createLockedBackgroundHarness();
    harness.backgroundDatabase.closeAsync.mockRejectedValueOnce(
      new Error('close failed'),
    );
    await harness.probe.armLockedBackgroundAccess();

    await expect(
      harness.probe.handleAppStateChange('background'),
    ).resolves.toBe('failed');
    await expect(harness.probe.handleAppStateChange('active')).resolves.toBe(
      'failed',
    );
  });

  it('fails verification when the protected success marker is absent', async () => {
    const harness = createLockedBackgroundHarness();
    await harness.probe.armLockedBackgroundAccess();

    await expect(
      harness.probe.handleAppStateChange('background'),
    ).resolves.toBe('passed');
    await expect(harness.probe.handleAppStateChange('active')).resolves.toBe(
      'failed',
    );
  });
});
