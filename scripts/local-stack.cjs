const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const COMPOSE_PROJECT = 'ayaw-kalimti-local';
const COMPOSE_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/docker-compose.local.yml',
);
const LOCAL_ENV_DIRECTORY = path.join(REPOSITORY_ROOT, 'supabase/.temp');
const LOCAL_ENV_PATH = path.join(LOCAL_ENV_DIRECTORY, 'compose.env');
const MIGRATION_DIRECTORY = path.join(REPOSITORY_ROOT, 'supabase/migrations');
const SEED_PATH = path.join(REPOSITORY_ROOT, 'supabase/seed.sql');
const EXPECTED_CLI_VERSION = '2.115.0';
const EXPECTED_VERSION_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/stack-versions.json',
);
const COMMANDS = new Set(['integration', 'reset', 'start', 'stop', 'verify']);
const LOCAL_ENV_PATTERN =
  /^POSTGRES_PASSWORD=[0-9a-f]{48}\r?\nJWT_SECRET=[0-9a-f]{64}\r?\n$/u;

function execute(
  command,
  args,
  {
    allowFailure = false,
    input,
    label = 'Local operation',
    run = spawnSync,
  } = {},
) {
  const result = run(command, args, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
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

function composeArgs(args) {
  return [
    'compose',
    '--project-name',
    COMPOSE_PROJECT,
    '--env-file',
    LOCAL_ENV_PATH,
    '--file',
    COMPOSE_PATH,
    ...args,
  ];
}

function runCompose(args, options = {}) {
  return runDocker(composeArgs(args), {
    label: 'Local Compose operation',
    ...options,
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

function applyVersionedSql() {
  const migrations = readdirSync(MIGRATION_DIRECTORY, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  for (const migration of migrations) {
    runSql(
      readFileSync(path.join(MIGRATION_DIRECTORY, migration), 'utf8'),
      'Local migration',
    );
  }
  runSql(readFileSync(SEED_PATH, 'utf8'), 'Local seed');
}

function configureAuthRole() {
  const { POSTGRES_PASSWORD: password } = readLocalEnvironment();
  runSql(
    `alter role supabase_auth_admin with password '${password}';`,
    'Local Auth role configuration',
    'supabase_admin',
  );
}

function startStack() {
  runDocker(['info', '--format', '{{.ServerVersion}}']);
  ensureLocalEnvironment();
  verifyComposeConfiguration();
  runCompose(['up', '--detach', '--wait', '--wait-timeout', '120', 'db']);
  configureAuthRole();
  runCompose(['up', '--detach', '--wait', '--wait-timeout', '120', 'auth']);
  applyVersionedSql();
}

function resetStack() {
  ensureLocalEnvironment();
  verifyComposeConfiguration();
  runCompose(['down', '--volumes', '--remove-orphans']);
  startStack();
}

function stopStack({ allowFailure = false, clean = false } = {}) {
  ensureLocalEnvironment();
  const args = ['down', '--remove-orphans'];
  if (clean) {
    args.push('--volumes');
  }
  return runCompose(args, { allowFailure });
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

function queryFixtureFingerprint() {
  const query = [
    "select count(*)::text || ':' || md5(string_agg(",
    "id::text || ':' || email || ':' ||",
    "to_char(created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),",
    "'|' order by id))",
    'from auth.users',
    "where email in ('fixture-a@example.invalid', 'fixture-b@example.invalid');",
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
  const fingerprint = result.stdout.trim();
  if (!fingerprint.startsWith('2:')) {
    throw new Error('The synthetic Auth fixture set is incomplete.');
  }
  return fingerprint;
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
  const fixtureFingerprint = queryFixtureFingerprint();
  await verifyAuthHealth();
  return { fixtureFingerprint, services };
}

function snapshotsMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function runIntegration() {
  let operationError;
  try {
    resetStack();
    const first = await verifyStack();
    resetStack();
    const second = await verifyStack();
    if (!snapshotsMatch(first, second)) {
      throw new Error('Repeated local resets produced different state.');
    }
  } catch (error) {
    operationError = error;
  }

  const cleanup = stopStack({ allowFailure: true, clean: true });
  if (operationError !== undefined) {
    throw operationError;
  }
  if (cleanup.error || cleanup.status !== 0) {
    throw new Error('Local stack cleanup failed.');
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
  assertComposeConfiguration,
  assertExpectedVersions,
  assertLoopbackPorts,
  assertProjectOwnership,
  collectStackVersions,
  composeArgs,
  execute,
  parseCommand,
  snapshotsMatch,
  validateLocalEnvironment,
  verifyAuthHealth,
};
