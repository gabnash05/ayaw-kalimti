import { applyLocalMigrations } from './migrations.js';

const createDatabase = () => ({
  execAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue(null),
});

describe('protected local migrations', () => {
  it('applies a new migration and records it in one transaction', async () => {
    const database = createDatabase();
    await applyLocalMigrations(database, () => 1234);
    const statements = (database.execAsync.mock.calls as Array<[string]>).map(
      ([source]) => source,
    );
    expect(statements).toEqual(
      expect.arrayContaining([
        'BEGIN IMMEDIATE TRANSACTION;',
        expect.stringContaining('CREATE TABLE local_saved_place_targets'),
        'INSERT INTO app_migrations (version, applied_at_ms) VALUES (1, 1234);',
        'COMMIT;',
      ]),
    );
  });

  it('does not apply or record an existing migration again', async () => {
    const database = createDatabase();
    database.getFirstAsync.mockResolvedValue({ version: 1 });
    await applyLocalMigrations(database);
    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE local_saved_place_targets'),
    );
    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app_migrations'),
    );
    expect(database.execAsync).toHaveBeenCalledWith('COMMIT;');
  });

  it('rolls back instead of recording a failed migration', async () => {
    const database = createDatabase();
    database.execAsync.mockImplementation((source: string) => {
      if (source.includes('CREATE TABLE local_saved_place_targets')) {
        return Promise.reject(new Error('migration failed'));
      }
      return Promise.resolve();
    });
    await expect(applyLocalMigrations(database)).rejects.toThrow(
      'migration failed',
    );
    expect(database.execAsync).toHaveBeenCalledWith('ROLLBACK;');
    expect(database.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app_migrations'),
    );
    expect(database.execAsync).not.toHaveBeenCalledWith('COMMIT;');
  });

  it('preserves the original migration diagnosis when rollback also fails', async () => {
    const database = createDatabase();
    const migrationError = new Error(
      'Error code 11: database disk image is malformed',
    );
    database.execAsync.mockImplementation((source: string) => {
      if (source.includes('CREATE TABLE local_saved_place_targets')) {
        return Promise.reject(migrationError);
      }
      if (source === 'ROLLBACK;') {
        return Promise.reject(new Error('rollback failed'));
      }
      return Promise.resolve();
    });

    await expect(applyLocalMigrations(database)).rejects.toBe(migrationError);
    expect(database.execAsync).toHaveBeenCalledWith('ROLLBACK;');
  });
});
