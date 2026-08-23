export interface SqlExecutor {
  execAsync(source: string): Promise<void>;
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS app_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at_ms INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS protected_local_state (
     key TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL,
     retention_started_at_ms INTEGER NOT NULL,
     expires_at_ms INTEGER
   );`,
];

export async function applyLocalMigrations(
  database: SqlExecutor,
  now: () => number = Date.now,
): Promise<void> {
  await database.execAsync('BEGIN IMMEDIATE TRANSACTION;');
  try {
    for (const [index, migration] of MIGRATIONS.entries()) {
      const version = index + 1;
      await database.execAsync(migration);
      await database.execAsync(
        `INSERT OR IGNORE INTO app_migrations (version, applied_at_ms) VALUES (${version}, ${now()});`,
      );
    }
    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
}
