export interface SqlExecutor {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

const MIGRATIONS = [
  `CREATE TABLE local_saved_place_targets (id TEXT PRIMARY KEY NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, display_name TEXT NOT NULL, updated_at_ms INTEGER NOT NULL);
   CREATE TABLE local_specific_destination_details (id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, label TEXT NOT NULL, address TEXT, updated_at_ms INTEGER NOT NULL);
   CREATE TABLE offline_evaluation_events (idempotency_key TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, occurred_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL);
   CREATE TABLE offline_notification_actions (idempotency_key TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, occurred_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL);
   CREATE TABLE evaluation_throttle_state (key TEXT PRIMARY KEY NOT NULL, started_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL);
   CREATE TABLE protected_diagnostics (id TEXT PRIMARY KEY NOT NULL, reason_code TEXT NOT NULL, occurred_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL);`,
];

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS app_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at_ms INTEGER NOT NULL);`;

export async function applyLocalMigrations(
  database: SqlExecutor,
  now: () => number = Date.now,
): Promise<void> {
  await database.execAsync('BEGIN IMMEDIATE TRANSACTION;');
  try {
    await database.execAsync(MIGRATIONS_TABLE);
    for (const [index, migration] of MIGRATIONS.entries()) {
      const version = index + 1;
      const applied = await database.getFirstAsync<{ version: number }>(
        `SELECT version FROM app_migrations WHERE version = ${version};`,
      );
      if (applied !== null) {
        continue;
      }
      await database.execAsync(migration);
      await database.execAsync(
        `INSERT INTO app_migrations (version, applied_at_ms) VALUES (${version}, ${now()});`,
      );
    }
    await database.execAsync('COMMIT;');
  } catch (error) {
    // The original SQLite diagnosis controls whether recovery may delete data.
    await database.execAsync('ROLLBACK;').catch(() => undefined);
    throw error;
  }
}
