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
  return {
    ...harness,
    backgroundDatabase,
    openDatabase,
    probe: new PhysicalStorageVerificationProbe(
      harness.runtime,
      harness.removeKey,
      () => 1000,
      { openDatabase },
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
    const { backgroundDatabase, database, openDatabase, probe } =
      createLockedBackgroundHarness();
    database.getFirstAsync.mockResolvedValue({
      reason_code: 'synthetic_locked_background_passed',
    });

    await probe.armLockedBackgroundAccess();
    await expect(probe.handleAppStateChange('background')).resolves.toBe(
      'passed',
    );
    await expect(probe.handleAppStateChange('active')).resolves.toBe('passed');

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
    let finishOpen: (() => void) | undefined;
    harness.openDatabase.mockImplementation(
      () =>
        new Promise<typeof harness.backgroundDatabase>((resolve) => {
          finishOpen = () => resolve(harness.backgroundDatabase);
        }),
    );
    await harness.probe.armLockedBackgroundAccess();

    const first = harness.probe.handleAppStateChange('background');
    const duplicate = harness.probe.handleAppStateChange('background');
    finishOpen?.();
    await Promise.all([first, duplicate]);

    expect(harness.openDatabase).toHaveBeenCalledTimes(1);
  });

  it('does not cancel a background attempt for a transitional app state', async () => {
    const harness = createLockedBackgroundHarness();
    let finishOpen: (() => void) | undefined;
    harness.openDatabase.mockImplementation(
      () =>
        new Promise<typeof harness.backgroundDatabase>((resolve) => {
          finishOpen = () => resolve(harness.backgroundDatabase);
        }),
    );
    await harness.probe.armLockedBackgroundAccess();

    const background = harness.probe.handleAppStateChange('background');
    const transitional = harness.probe.handleAppStateChange('inactive');
    finishOpen?.();
    await Promise.all([background, transitional]);

    expect(harness.openDatabase).toHaveBeenCalledTimes(1);
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe('none');
  });

  it('finishes one background open when the app becomes active during the attempt', async () => {
    const harness = createLockedBackgroundHarness();
    let finishOpen: (() => void) | undefined;
    harness.openDatabase.mockImplementation(
      () =>
        new Promise<typeof harness.backgroundDatabase>((resolve) => {
          finishOpen = () => resolve(harness.backgroundDatabase);
        }),
    );
    harness.database.getFirstAsync.mockResolvedValue({
      reason_code: 'synthetic_locked_background_passed',
    });
    await harness.probe.armLockedBackgroundAccess();

    const background = harness.probe.handleAppStateChange('background');
    const active = harness.probe.handleAppStateChange('active');
    finishOpen?.();

    await background;
    await expect(active).resolves.toBe('passed');
    expect(harness.openDatabase).toHaveBeenCalledTimes(1);
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe('none');
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
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe('open');
  });

  it('reports a fixed diagnostic when the background marker cannot be written', async () => {
    const harness = createLockedBackgroundHarness();
    harness.backgroundDatabase.execAsync.mockRejectedValueOnce(
      new Error('sensitive write failure'),
    );
    await harness.probe.armLockedBackgroundAccess();

    await expect(
      harness.probe.handleAppStateChange('background'),
    ).resolves.toBe('failed');
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe('write');
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
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe('close');
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
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe(
      'marker-missing',
    );
  });

  it('reports a fixed diagnostic when protected storage cannot reopen in the foreground', async () => {
    const harness = createLockedBackgroundHarness();
    harness.runtime.initialize = jest
      .fn()
      .mockResolvedValueOnce(harness.database)
      .mockRejectedValueOnce(new Error('sensitive foreground failure'));
    await harness.probe.armLockedBackgroundAccess();

    await harness.probe.handleAppStateChange('background');
    await expect(harness.probe.handleAppStateChange('active')).resolves.toBe(
      'failed',
    );
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe(
      'foreground-open',
    );
  });

  it('reports a fixed diagnostic and still cleans up when the marker cannot be read', async () => {
    const harness = createLockedBackgroundHarness();
    harness.database.getFirstAsync.mockRejectedValueOnce(
      new Error('sensitive read failure'),
    );
    await harness.probe.armLockedBackgroundAccess();

    await harness.probe.handleAppStateChange('background');
    await expect(harness.probe.handleAppStateChange('active')).resolves.toBe(
      'failed',
    );
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe('marker-read');
    expect(harness.database.execAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        "DELETE FROM protected_diagnostics WHERE id = 'synthetic-locked-background-probe'",
      ),
    );
  });

  it('reports a fixed diagnostic when the marker cannot be cleaned up', async () => {
    const harness = createLockedBackgroundHarness();
    harness.database.getFirstAsync.mockResolvedValue({
      reason_code: 'synthetic_locked_background_passed',
    });
    harness.database.execAsync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('sensitive cleanup failure'));
    await harness.probe.armLockedBackgroundAccess();

    await harness.probe.handleAppStateChange('background');
    await expect(harness.probe.handleAppStateChange('active')).resolves.toBe(
      'failed',
    );
    expect(harness.probe.getLockedBackgroundFailureStage()).toBe(
      'marker-cleanup',
    );
  });
});
