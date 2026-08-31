const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const COMPOSE_PROJECT = 'ayaw-kalimti-local';
const COMPOSE_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/docker-compose.local.yml',
);
const LOCAL_ENV_DIRECTORY = path.join(REPOSITORY_ROOT, 'supabase/.temp');
const LOCAL_ENV_PATH = path.join(LOCAL_ENV_DIRECTORY, 'compose.env');
const SEED_PATH = path.join(REPOSITORY_ROOT, 'supabase/seed.sql');
const SUPABASE_CLI_PATH = path.join(
  REPOSITORY_ROOT,
  'node_modules/supabase/dist/supabase.js',
);
const LOCAL_DATABASE_URL = 'postgresql://postgres@127.0.0.1:54322/postgres';
const EXPECTED_CLI_VERSION = '2.115.0';
const EXPECTED_VERSION_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/stack-versions.json',
);
const COMMANDS = new Set(['integration', 'reset', 'start', 'stop', 'verify']);
const LOCAL_ENV_PATTERN =
  /^POSTGRES_PASSWORD=[0-9a-f]{48}\r?\nJWT_SECRET=[0-9a-f]{64}\r?\n$/u;
const CLEANUP_ENVIRONMENT = Object.freeze({
  JWT_SECRET: 'local-cleanup-placeholder',
  POSTGRES_PASSWORD: 'local-cleanup-placeholder',
});
const EXPECTED_AUTH_SNAPSHOT = Object.freeze({
  auditLogEntries: 0,
  credentialedUsers: 0,
  flowState: 0,
  identities: 0,
  mfaChallenges: 0,
  mfaFactors: 0,
  oneTimeTokens: 0,
  pendingAuthArtifacts: 0,
  refreshTokens: 0,
  sessions: 0,
  users: '2:dcf94ac8d325b23f593ebe6cb20cd30d',
});
const MIGRATION_PROBE_VERSION = '20991231235959';

function execute(
  command,
  args,
  {
    allowFailure = false,
    environment = {},
    input,
    label = 'Local operation',
    run = spawnSync,
    workingDirectory = REPOSITORY_ROOT,
  } = {},
) {
  const result = run(command, args, {
    cwd: workingDirectory,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
    input,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });

  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`${label} failed without exposing command output.`);
  }

  return result;
}

function runDocker(args, options = {}) {
  return execute('docker', args, {
    label: 'Local Docker operation',
    ...options,
  });
}

function composeArgs(args, { includeEnvironmentFile = true } = {}) {
  const command = ['compose', '--project-name', COMPOSE_PROJECT];
  if (includeEnvironmentFile) {
    command.push('--env-file', LOCAL_ENV_PATH);
  }
  command.push('--file', COMPOSE_PATH);
  return [...command, ...args];
}

function runCompose(args, options = {}) {
  const { includeEnvironmentFile = true, ...executeOptions } = options;
  return runDocker(composeArgs(args, { includeEnvironmentFile }), {
    label: 'Local Compose operation',
    ...executeOptions,
  });
}

function parseCommand(args) {
  if (args.length !== 1 || !COMMANDS.has(args[0])) {
    throw new Error('Choose exactly one supported local-stack command.');
  }

  return args[0];
}

function assertOrdinaryDirectory(directory) {
  const entry = lstatSync(directory);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(
      'The local runtime directory is not an ordinary directory.',
    );
  }
}

function validateLocalEnvironment(contents) {
  if (!LOCAL_ENV_PATTERN.test(contents)) {
    throw new Error('The ignored local environment file is malformed.');
  }
}

function ensureLocalEnvironment() {
  if (!existsSync(LOCAL_ENV_DIRECTORY)) {
    mkdirSync(LOCAL_ENV_DIRECTORY, { mode: 0o700 });
  }
  assertOrdinaryDirectory(LOCAL_ENV_DIRECTORY);

  if (!existsSync(LOCAL_ENV_PATH)) {
    const contents = [
      `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`,
      `JWT_SECRET=${randomBytes(32).toString('hex')}`,
      '',
    ].join('\n');
    writeFileSync(LOCAL_ENV_PATH, contents, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  }

  const entry = lstatSync(LOCAL_ENV_PATH);
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error(
      'The ignored local environment file is not an ordinary file.',
    );
  }
  chmodSync(LOCAL_ENV_PATH, 0o600);
  validateLocalEnvironment(readFileSync(LOCAL_ENV_PATH, 'utf8'));
}

function readLocalEnvironment() {
  const contents = readFileSync(LOCAL_ENV_PATH, 'utf8');
  validateLocalEnvironment(contents);
  return Object.fromEntries(
    contents
      .trim()
      .split(/\r?\n/u)
      .map((line) => line.split('=')),
  );
}

function publishedBindings(service) {
  return (service?.ports ?? []).map((port) => {
    if (typeof port === 'string') {
      return port;
    }
    return `${port.host_ip ?? ''}:${port.published ?? ''}:${port.target ?? ''}`;
  });
}

function assertComposeConfiguration(configuration) {
  const serviceEntries = Object.entries(configuration?.services ?? {});
  const serviceNames = serviceEntries.map(([name]) => name).sort();
  if (JSON.stringify(serviceNames) !== JSON.stringify(['auth', 'db'])) {
    throw new Error('The local Compose service boundary is invalid.');
  }

  for (const [, service] of serviceEntries) {
    const bindings = publishedBindings(service);
    if (bindings.length !== 1 || !bindings[0].startsWith('127.0.0.1:')) {
      throw new Error('A local Compose port is not explicitly loopback-bound.');
    }
  }
}

function verifyComposeConfiguration() {
  const result = runCompose(['config', '--format', 'json']);
  assertComposeConfiguration(JSON.parse(result.stdout));
}

function runSql(contents, label, username = 'postgres') {
  runCompose(
    [
      'exec',
      '--no-TTY',
      'db',
      'psql',
      '--username',
      username,
      '--dbname',
      'postgres',
      '--set',
      'ON_ERROR_STOP=1',
    ],
    { input: contents, label },
  );
}

function migrationArguments(workDirectory = REPOSITORY_ROOT) {
  return [
    SUPABASE_CLI_PATH,
    '--workdir',
    workDirectory,
    'migration',
    'up',
    '--db-url',
    LOCAL_DATABASE_URL,
    '--yes',
  ];
}

function migrationEnvironment(password) {
  return {
    DO_NOT_TRACK: '1',
    PGPASSWORD: password,
    PGSSLMODE: 'disable',
    SUPABASE_TELEMETRY_DISABLED: '1',
  };
}

function applyPendingMigrations({
  run = spawnSync,
  workDirectory = REPOSITORY_ROOT,
} = {}) {
  const { POSTGRES_PASSWORD: password } = readLocalEnvironment();
  execute(process.execPath, migrationArguments(workDirectory), {
    environment: migrationEnvironment(password),
    label: 'Local migration',
    run,
  });
}

function applyVersionedInputs({
  applyMigrations = applyPendingMigrations,
  applySeed = () => runSql(readFileSync(SEED_PATH, 'utf8'), 'Local seed'),
  workDirectory = REPOSITORY_ROOT,
} = {}) {
  applyMigrations({ workDirectory });
  applySeed();
}

function configureAuthRole() {
  const { POSTGRES_PASSWORD: password } = readLocalEnvironment();
  runSql(
    `alter role supabase_auth_admin with password '${password}';`,
    'Local Auth role configuration',
    'supabase_admin',
  );
}

function startStack({ migrationWorkDirectory = REPOSITORY_ROOT } = {}) {
  runDocker(['info', '--format', '{{.ServerVersion}}']);
  ensureLocalEnvironment();
  verifyComposeConfiguration();
  runCompose(['up', '--detach', '--wait', '--wait-timeout', '120', 'db']);
  configureAuthRole();
  runCompose(['up', '--detach', '--wait', '--wait-timeout', '120', 'auth']);
  applyVersionedInputs({ workDirectory: migrationWorkDirectory });
}

function resetStack() {
  ensureLocalEnvironment();
  verifyComposeConfiguration();
  runCompose(['down', '--volumes', '--remove-orphans']);
  startStack();
}

function stopStack({
  allowFailure = false,
  clean = false,
  run = spawnSync,
} = {}) {
  const args = ['down', '--remove-orphans'];
  if (clean) {
    args.push('--volumes');
  }
  return runCompose(args, {
    allowFailure,
    environment: CLEANUP_ENVIRONMENT,
    includeEnvironmentFile: false,
    run,
  });
}

function listProjectContainers() {
  const result = runCompose(['ps', '--quiet']);
  return result.stdout
    .split(/\r?\n/u)
    .map((id) => id.trim())
    .filter(Boolean)
    .sort();
}

function inspectContainers(ids) {
  if (ids.length === 0) {
    throw new Error('No local Supabase containers are running.');
  }

  return JSON.parse(runDocker(['inspect', ...ids]).stdout);
}

function assertProjectOwnership(containers) {
  for (const container of containers) {
    if (
      container?.Config?.Labels?.['com.docker.compose.project'] !==
      COMPOSE_PROJECT
    ) {
      throw new Error('A container is not owned by the local Compose project.');
    }
  }
}

function assertLoopbackPorts(containers) {
  for (const container of containers) {
    const ports = container?.NetworkSettings?.Ports ?? {};
    for (const bindings of Object.values(ports)) {
      if (bindings === null) {
        continue;
      }
      for (const binding of bindings) {
        if (binding.HostIp !== '127.0.0.1') {
          throw new Error('A local Supabase port is not loopback-bound.');
        }
      }
    }
  }
}

function collectStackVersions(containers) {
  return Object.fromEntries(
    containers
      .map((container) => [
        container.Config.Labels['com.docker.compose.service'],
        container.Config.Image,
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function readExpectedVersions() {
  return JSON.parse(readFileSync(EXPECTED_VERSION_PATH, 'utf8'));
}

function assertExpectedVersions(actualServices, expected) {
  if (expected.orchestration !== 'repository-owned-docker-compose') {
    throw new Error('Committed local orchestration evidence is invalid.');
  }
  if (expected.supabaseCli !== EXPECTED_CLI_VERSION) {
    throw new Error('Committed Supabase CLI evidence does not match the pin.');
  }
  if (expected.postgresMajor !== 17) {
    throw new Error('Committed PostgreSQL evidence does not match config.');
  }
  if (JSON.stringify(actualServices) !== JSON.stringify(expected.services)) {
    throw new Error(
      'Running local service images differ from pinned evidence.',
    );
  }
}

function assertAuthFixtureSnapshot(snapshot) {
  const expectedEntries = Object.entries(EXPECTED_AUTH_SNAPSHOT);
  if (
    snapshot === null ||
    typeof snapshot !== 'object' ||
    Object.keys(snapshot).length !== expectedEntries.length ||
    expectedEntries.some(([key, value]) => snapshot[key] !== value)
  ) {
    throw new Error('The synthetic Auth fixture state is not exact.');
  }
}

function queryAuthFixtureSnapshot() {
  const query = [
    'select json_build_object(',
    "'auditLogEntries', (select count(*) from auth.audit_log_entries),",
    "'credentialedUsers', (select count(*) from auth.users where",
    "coalesce(encrypted_password, '') <> '' or coalesce(phone, '') <> '' or",
    'email_confirmed_at is not null or phone_confirmed_at is not null or',
    'last_sign_in_at is not null or invited_at is not null or',
    'is_sso_user is true or is_anonymous is true),',
    "'flowState', (select count(*) from auth.flow_state),",
    "'identities', (select count(*) from auth.identities),",
    "'mfaChallenges', (select count(*) from auth.mfa_challenges),",
    "'mfaFactors', (select count(*) from auth.mfa_factors),",
    "'oneTimeTokens', (select count(*) from auth.one_time_tokens),",
    "'pendingAuthArtifacts', (select count(*) from auth.users where",
    "coalesce(confirmation_token, '') <> '' or confirmation_sent_at is not null or",
    "coalesce(recovery_token, '') <> '' or recovery_sent_at is not null or",
    "coalesce(email_change, '') <> '' or coalesce(email_change_token_new, '') <> '' or",
    "coalesce(email_change_token_current, '') <> '' or email_change_sent_at is not null or",
    "email_change_confirm_status <> 0 or coalesce(phone_change, '') <> '' or",
    "coalesce(phone_change_token, '') <> '' or phone_change_sent_at is not null or",
    "coalesce(reauthentication_token, '') <> '' or reauthentication_sent_at is not null),",
    "'refreshTokens', (select count(*) from auth.refresh_tokens),",
    "'sessions', (select count(*) from auth.sessions),",
    "'users', (select count(*)::text || ':' || coalesce(md5(string_agg(",
    "id::text || ':' || email || ':' ||",
    "to_char(created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')",
    "|| ':' || to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')",
    "|| ':' || raw_app_meta_data::text || ':' || raw_user_meta_data::text,",
    "'|' order by id)), md5('')) from auth.users)",
    ');',
  ].join(' ');
  const result = runCompose([
    'exec',
    '--no-TTY',
    'db',
    'psql',
    '--username',
    'postgres',
    '--dbname',
    'postgres',
    '--tuples-only',
    '--no-align',
    '--command',
    query,
  ]);
  let snapshot;
  try {
    snapshot = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error('The synthetic Auth fixture state is unreadable.');
  }
  assertAuthFixtureSnapshot(snapshot);
  return snapshot;
}

function requestAuthHealth() {
  return new Promise((resolve) => {
    const request = http.get(
      'http://127.0.0.1:54321/health',
      { timeout: 5000 },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function verifyAuthHealth({
  attempts = 20,
  delayMs = 250,
  probe = requestAuthHealth,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await probe()) {
      return;
    }
    if (attempt < attempts) {
      await wait(delayMs);
    }
  }
  throw new Error('Local Auth health check did not pass.');
}

async function verifyStack() {
  ensureLocalEnvironment();
  verifyComposeConfiguration();
  const containers = inspectContainers(listProjectContainers());
  assertProjectOwnership(containers);
  assertLoopbackPorts(containers);
  const services = collectStackVersions(containers);
  assertExpectedVersions(services, readExpectedVersions());
  const auth = queryAuthFixtureSnapshot();
  await verifyAuthHealth();
  return { auth, services };
}

function snapshotsMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveMigrationProbeDirectory(workDirectory, errorMessage) {
  const temporaryParent = path.resolve(os.tmpdir());
  const resolvedWorkDirectory = path.resolve(workDirectory);
  if (
    path.dirname(resolvedWorkDirectory) !== temporaryParent ||
    !path.basename(resolvedWorkDirectory).startsWith('ayaw-kalimti-migrations-')
  ) {
    throw new Error(errorMessage);
  }
  assertOrdinaryDirectory(resolvedWorkDirectory);
  return resolvedWorkDirectory;
}

function createMigrationProbeProject() {
  const temporaryParent = path.resolve(os.tmpdir());
  const workDirectory = mkdtempSync(
    path.join(temporaryParent, 'ayaw-kalimti-migrations-'),
  );
  const resolvedWorkDirectory = resolveMigrationProbeDirectory(
    workDirectory,
    'The migration probe directory escaped its boundary.',
  );

  const supabaseDirectory = path.join(resolvedWorkDirectory, 'supabase');
  const migrationDirectory = path.join(supabaseDirectory, 'migrations');
  mkdirSync(migrationDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(
    path.join(supabaseDirectory, 'config.toml'),
    readFileSync(path.join(REPOSITORY_ROOT, 'supabase/config.toml'), 'utf8'),
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  );
  writeFileSync(path.join(supabaseDirectory, 'seed.sql'), '', {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  writeFileSync(
    path.join(
      migrationDirectory,
      `${MIGRATION_PROBE_VERSION}_non_idempotent_probe.sql`,
    ),
    [
      'create schema local_verification;',
      'create table local_verification.migration_probe (id integer primary key);',
      'insert into local_verification.migration_probe (id) values (1);',
      '',
    ].join('\n'),
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  );
  return resolvedWorkDirectory;
}

function removeMigrationProbeProject(workDirectory) {
  const resolvedWorkDirectory = resolveMigrationProbeDirectory(
    workDirectory,
    'The migration probe cleanup boundary is invalid.',
  );
  rmSync(resolvedWorkDirectory, { recursive: true });
}

function assertMigrationProbeAppliedOnce() {
  const query = [
    "select (select count(*) from supabase_migrations.schema_migrations where version = '",
    MIGRATION_PROBE_VERSION,
    "')::text || ':' || (select count(*) from local_verification.migration_probe)::text;",
  ].join('');
  const result = runCompose([
    'exec',
    '--no-TTY',
    'db',
    'psql',
    '--username',
    'postgres',
    '--dbname',
    'postgres',
    '--tuples-only',
    '--no-align',
    '--command',
    query,
  ]);
  if (result.stdout.trim() !== '1:1') {
    throw new Error(
      'The tracked migration probe was not applied exactly once.',
    );
  }
}

function assertMigrationProbeRemoved() {
  runSql(
    [
      'do $$',
      'declare probe_history_count integer := 0;',
      'begin',
      "if to_regclass('supabase_migrations.schema_migrations') is not null then",
      `execute 'select count(*) from supabase_migrations.schema_migrations where version = ''${MIGRATION_PROBE_VERSION}''' into probe_history_count;`,
      'end if;',
      "if to_regclass('local_verification.migration_probe') is not null or probe_history_count <> 0 then",
      "raise exception 'synthetic migration probe remains';",
      'end if;',
      'end $$;',
    ].join('\n'),
    'Migration probe cleanup verification',
  );
}

function verifyTrackedMigrationReplay() {
  const workDirectory = createMigrationProbeProject();
  try {
    startStack({ migrationWorkDirectory: workDirectory });
    startStack({ migrationWorkDirectory: workDirectory });
    assertMigrationProbeAppliedOnce();
  } finally {
    removeMigrationProbeProject(workDirectory);
  }
}

function integrationFailure(operationError, cleanup) {
  const cleanupFailed = cleanup.error || cleanup.status !== 0;
  if (operationError !== undefined && cleanupFailed) {
    return new Error('Local integration and cleanup both failed.');
  }
  if (operationError !== undefined) {
    return operationError;
  }
  if (cleanupFailed) {
    return new Error('Local stack cleanup failed.');
  }
  return undefined;
}

async function runIntegration({
  assertProbeRemoved = assertMigrationProbeRemoved,
  cleanup = () => stopStack({ allowFailure: true, clean: true }),
  reset = resetStack,
  verify = verifyStack,
  verifyMigrationReplay = verifyTrackedMigrationReplay,
} = {}) {
  let operationError;
  try {
    reset();
    const first = await verify();
    verifyMigrationReplay();
    reset();
    assertProbeRemoved();
    const second = await verify();
    if (!snapshotsMatch(first, second)) {
      throw new Error('Repeated local resets produced different state.');
    }
  } catch (error) {
    operationError = error;
  }

  let cleanupResult;
  try {
    cleanupResult = cleanup();
  } catch (error) {
    cleanupResult = { error, status: null };
  }
  const failure = integrationFailure(operationError, cleanupResult);
  if (failure !== undefined) {
    throw failure;
  }
}

async function main(args = process.argv.slice(2)) {
  const command = parseCommand(args);
  if (command === 'start') {
    startStack();
    process.stdout.write('Local PostgreSQL/Auth stack is ready.\n');
    return;
  }
  if (command === 'reset') {
    resetStack();
    process.stdout.write('Local database reset completed.\n');
    return;
  }
  if (command === 'stop') {
    stopStack();
    process.stdout.write('Local stack stopped.\n');
    return;
  }
  if (command === 'verify') {
    await verifyStack();
    process.stdout.write('Local PostgreSQL/Auth verification passed.\n');
    return;
  }

  await runIntegration();
  process.stdout.write(
    'Deterministic local integration verification passed.\n',
  );
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown failure.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  applyVersionedInputs,
  assertAuthFixtureSnapshot,
  assertComposeConfiguration,
  assertExpectedVersions,
  assertLoopbackPorts,
  assertProjectOwnership,
  collectStackVersions,
  composeArgs,
  execute,
  integrationFailure,
  migrationArguments,
  migrationEnvironment,
  parseCommand,
  runIntegration,
  snapshotsMatch,
  stopStack,
  validateLocalEnvironment,
  verifyAuthHealth,
};
