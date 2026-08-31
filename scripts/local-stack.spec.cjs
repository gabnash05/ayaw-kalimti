/* global jest */
const { describe, expect, test } = require('@jest/globals');
const {
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
} = require('./local-stack.cjs');

describe('local stack command boundary', () => {
  test.each(['integration', 'reset', 'start', 'stop', 'verify'])(
    'accepts %s',
    (command) => expect(parseCommand([command])).toBe(command),
  );

  test.each([
    [[]],
    [['reset', '--linked']],
    [['reset', '--db-url', 'example']],
    [['unknown']],
  ])('rejects unsupported or remote-capable arguments', (args) => {
    expect(() => parseCommand(args)).toThrow(
      'Choose exactly one supported local-stack command.',
    );
  });

  test('always scopes Compose to the repository project and files', () => {
    expect(composeArgs(['down'])).toEqual(
      expect.arrayContaining([
        '--project-name',
        'ayaw-kalimti-local',
        '--env-file',
        expect.stringMatching(/supabase[\\/]\.temp[\\/]compose\.env$/u),
        '--file',
        expect.stringMatching(/supabase[\\/]docker-compose\.local\.yml$/u),
        'down',
      ]),
    );
  });

  test('cleanup remains project-scoped without reading the generated environment', () => {
    const args = composeArgs(['down', '--remove-orphans'], {
      includeEnvironmentFile: false,
    });

    expect(args).toEqual(
      expect.arrayContaining([
        '--project-name',
        'ayaw-kalimti-local',
        '--file',
        expect.stringMatching(/supabase[\\/]docker-compose\.local\.yml$/u),
        'down',
        '--remove-orphans',
      ]),
    );
    expect(args).not.toContain('--env-file');
  });

  test('does not expose captured child-process output on failure', () => {
    const run = jest.fn(() => ({
      status: 1,
      stdout: 'generated-local-key',
      stderr: 'sensitive-child-output',
    }));

    expect(() => execute('test', [], { label: 'Probe', run })).toThrow(
      'Probe failed without exposing command output.',
    );
  });

  test('passes child-only environment without mutating the parent process', () => {
    const original = process.env.PGPASSWORD;
    const run = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));

    execute('test', [], {
      environment: { PGPASSWORD: 'synthetic-child-only' },
      run,
    });

    expect(run.mock.calls[0][2].env.PGPASSWORD).toBe('synthetic-child-only');
    expect(process.env.PGPASSWORD).toBe(original);
  });
});

describe('tracked local migrations', () => {
  test('targets only the fixed loopback database through the pinned CLI', () => {
    const args = migrationArguments('synthetic-workdir');

    expect(args[0]).toMatch(
      /node_modules[\\/]supabase[\\/]dist[\\/]supabase\.js$/u,
    );
    expect(args).toEqual(
      expect.arrayContaining([
        '--workdir',
        'synthetic-workdir',
        'migration',
        'up',
        '--db-url',
        'postgresql://postgres@127.0.0.1:54322/postgres',
        '--yes',
      ]),
    );
    expect(args).not.toContain('--linked');
    expect(args).not.toContain('--include-all');
    expect(args.join(' ')).not.toMatch(/password|generated-local-key/iu);
  });

  test('supplies the generated password only through the child environment', () => {
    expect(migrationEnvironment('synthetic-password')).toEqual({
      DO_NOT_TRACK: '1',
      PGPASSWORD: 'synthetic-password',
      PGSSLMODE: 'disable',
      SUPABASE_TELEMETRY_DISABLED: '1',
    });
  });

  test('applies pending migrations before the idempotent seed', () => {
    const order = [];

    applyVersionedInputs({
      applyMigrations: () => order.push('migrations'),
      applySeed: () => order.push('seed'),
      workDirectory: 'synthetic-workdir',
    });

    expect(order).toEqual(['migrations', 'seed']);
  });
});

describe('local-only Compose enforcement', () => {
  const safeConfiguration = {
    services: {
      auth: {
        ports: [{ host_ip: '127.0.0.1', published: 54321, target: 9999 }],
      },
      db: {
        ports: [{ host_ip: '127.0.0.1', published: 54322, target: 5432 }],
      },
    },
  };

  test('accepts exactly Auth and PostgreSQL with loopback mappings', () => {
    expect(() => assertComposeConfiguration(safeConfiguration)).not.toThrow();
  });

  test('rejects additional services', () => {
    expect(() =>
      assertComposeConfiguration({
        services: { ...safeConfiguration.services, studio: { ports: [] } },
      }),
    ).toThrow('The local Compose service boundary is invalid.');
  });

  test.each(['0.0.0.0', '::', ''])('rejects a %s host mapping', (hostIp) => {
    expect(() =>
      assertComposeConfiguration({
        services: {
          ...safeConfiguration.services,
          db: {
            ports: [{ host_ip: hostIp, published: 54322, target: 5432 }],
          },
        },
      }),
    ).toThrow('A local Compose port is not explicitly loopback-bound.');
  });

  test('rejects any publicly bound running container port', () => {
    expect(() =>
      assertLoopbackPorts([
        {
          NetworkSettings: {
            Ports: {
              '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '54322' }],
            },
          },
        },
      ]),
    ).toThrow('A local Supabase port is not loopback-bound.');
  });

  test('rejects a container owned by another Compose project', () => {
    expect(() =>
      assertProjectOwnership([
        { Config: { Labels: { 'com.docker.compose.project': 'other' } } },
      ]),
    ).toThrow('A container is not owned by the local Compose project.');
  });
});

describe('local generated environment validation', () => {
  const valid = `POSTGRES_PASSWORD=${'a'.repeat(48)}\nJWT_SECRET=${'b'.repeat(64)}\n`;

  test('accepts only the two generated local values', () => {
    expect(() => validateLocalEnvironment(valid)).not.toThrow();
  });

  test.each([
    '',
    'POSTGRES_PASSWORD=human-value\nJWT_SECRET=value\n',
    `${valid}REMOTE_DATABASE_URL=https://example.invalid\n`,
  ])('rejects malformed or expanded environment content', (contents) => {
    expect(() => validateLocalEnvironment(contents)).toThrow(
      'The ignored local environment file is malformed.',
    );
  });
});

describe('local Auth readiness', () => {
  test('retries a transient startup failure and then succeeds', async () => {
    const probe = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      verifyAuthHealth({ attempts: 3, delayMs: 1, probe, wait }),
    ).resolves.toBeUndefined();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  test('fails safely after the bounded readiness window', async () => {
    const probe = jest.fn().mockResolvedValue(false);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      verifyAuthHealth({ attempts: 2, delayMs: 1, probe, wait }),
    ).rejects.toThrow('Local Auth health check did not pass.');
    expect(probe).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
});

describe('exact local Auth fixture state', () => {
  const expected = {
    auditLogEntries: 0,
    flowState: 0,
    identities: 0,
    mfaChallenges: 0,
    mfaFactors: 0,
    oneTimeTokens: 0,
    refreshTokens: 0,
    sessions: 0,
    users: '2:6730e56c630e37d43393c3d464e2c54d',
  };

  test('accepts only the complete fixed non-login fixture snapshot', () => {
    expect(() => assertAuthFixtureSnapshot(expected)).not.toThrow();
  });

  test.each([
    ['missing fixture', { ...expected, users: '1:synthetic' }],
    ['changed fixture', { ...expected, users: '2:changed' }],
    ['unexpected third user', { ...expected, users: '3:synthetic' }],
    ['residual identity', { ...expected, identities: 1 }],
    ['residual session', { ...expected, sessions: 1 }],
    ['residual refresh token', { ...expected, refreshTokens: 1 }],
    ['additional field', { ...expected, unexpected: 1 }],
  ])('rejects %s state', (_scenario, snapshot) => {
    expect(() => assertAuthFixtureSnapshot(snapshot)).toThrow(
      'The synthetic Auth fixture state is not exact.',
    );
  });
});

describe('local integration cleanup', () => {
  const successfulCleanup = { status: 0 };
  const failedCleanup = { status: 1 };

  test('reports an operation failure when cleanup succeeds', () => {
    const operationError = new Error('sanitized operation failure');

    expect(integrationFailure(operationError, successfulCleanup)).toBe(
      operationError,
    );
  });

  test('reports cleanup failure when the operation succeeds', () => {
    expect(integrationFailure(undefined, failedCleanup)).toEqual(
      new Error('Local stack cleanup failed.'),
    );
  });

  test('reports both failures instead of masking cleanup failure', () => {
    expect(
      integrationFailure(new Error('operation failed'), failedCleanup),
    ).toEqual(new Error('Local integration and cleanup both failed.'));
  });

  test('cleanup does not depend on a generated environment file', () => {
    const run = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));

    expect(stopStack({ clean: true, run })).toEqual(
      expect.objectContaining({ status: 0 }),
    );
    const [command, args, options] = run.mock.calls[0];
    expect(command).toBe('docker');
    expect(args).toEqual(
      expect.arrayContaining(['down', '--remove-orphans', '--volumes']),
    );
    expect(args).not.toContain('--env-file');
    expect(options.env).toEqual(
      expect.objectContaining({
        JWT_SECRET: 'local-cleanup-placeholder',
        POSTGRES_PASSWORD: 'local-cleanup-placeholder',
      }),
    );
  });

  test('attempts cleanup once after an operation failure', async () => {
    const cleanup = jest.fn(() => successfulCleanup);

    await expect(
      runIntegration({
        cleanup,
        reset: () => {
          throw new Error('sanitized operation failure');
        },
      }),
    ).rejects.toThrow('sanitized operation failure');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('preserves both failures when cleanup throws', async () => {
    const cleanup = jest.fn(() => {
      throw new Error('native cleanup output');
    });

    await expect(
      runIntegration({
        cleanup,
        reset: () => {
          throw new Error('sanitized operation failure');
        },
      }),
    ).rejects.toThrow('Local integration and cleanup both failed.');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('reports a cleanup-only spawn failure after successful work', async () => {
    const snapshot = { auth: 'synthetic', services: {} };

    await expect(
      runIntegration({
        assertProbeRemoved: jest.fn(),
        cleanup: () => ({ error: new Error('spawn failed'), status: null }),
        reset: jest.fn(),
        verify: jest.fn().mockResolvedValue(snapshot),
        verifyMigrationReplay: jest.fn(),
      }),
    ).rejects.toThrow('Local stack cleanup failed.');
  });
});

describe('pinned stack evidence', () => {
  const containers = [
    {
      Config: {
        Image: 'example/postgres:17',
        Labels: { 'com.docker.compose.service': 'db' },
      },
    },
    {
      Config: {
        Image: 'example/auth:1',
        Labels: { 'com.docker.compose.service': 'auth' },
      },
    },
  ];

  test('collects sorted application service image versions', () => {
    expect(collectStackVersions(containers)).toEqual({
      auth: 'example/auth:1',
      db: 'example/postgres:17',
    });
  });

  test('accepts matching orchestration, CLI, PostgreSQL, and image evidence', () => {
    expect(() =>
      assertExpectedVersions(
        { auth: 'example/auth:1', db: 'example/postgres:17' },
        {
          orchestration: 'repository-owned-docker-compose',
          supabaseCli: '2.115.0',
          postgresMajor: 17,
          services: { auth: 'example/auth:1', db: 'example/postgres:17' },
        },
      ),
    ).not.toThrow();
  });

  test('rejects service-image drift', () => {
    expect(() =>
      assertExpectedVersions(
        { auth: 'example/auth:2' },
        {
          orchestration: 'repository-owned-docker-compose',
          supabaseCli: '2.115.0',
          postgresMajor: 17,
          services: { auth: 'example/auth:1' },
        },
      ),
    ).toThrow('Running local service images differ from pinned evidence.');
  });
});

test('compares deterministic reset snapshots exactly', () => {
  const snapshot = {
    auth: { users: 'synthetic' },
    services: { auth: 'example/auth:1' },
  };

  expect(snapshotsMatch(snapshot, { ...snapshot })).toBe(true);
  expect(
    snapshotsMatch(snapshot, {
      ...snapshot,
      auth: { users: 'different' },
    }),
  ).toBe(false);
});
