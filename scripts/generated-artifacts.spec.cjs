const { describe, expect, test } = require('@jest/globals');
const {
  runGeneratedArtifactChecks,
  validateGeneratedArtifacts,
} = require('./generated-artifacts.cjs');

const validArtifact = {
  command: ['generator', '--write'],
  id: 'api-client',
  outputPaths: ['packages/api-client/src/generated'],
};

describe('generated artifact checks', () => {
  test('accepts clean generated output after a successful generator run', () => {
    const commands = [];
    const statuses = [];
    const runCommand = (...args) => {
      commands.push(args);
      return { status: 0 };
    };
    const getStatus = (...args) => {
      statuses.push(args);
      return '';
    };

    runGeneratedArtifactChecks({
      artifacts: [validArtifact],
      cwd: '/workspace',
      getStatus,
      runCommand,
    });

    expect(commands).toEqual([['generator', ['--write'], '/workspace']]);
    expect(statuses).toEqual([
      ['packages/api-client/src/generated', '/workspace'],
    ]);
  });

  test('rejects an invalid artifact configuration', () => {
    expect(() =>
      validateGeneratedArtifacts([{ ...validArtifact, outputPaths: [] }]),
    ).toThrow('needs at least one output path');

    expect(() =>
      validateGeneratedArtifacts([
        { ...validArtifact, outputPaths: ['../outside-workspace'] },
      ]),
    ).toThrow('unsafe output path');
  });

  test('fails once when generation fails instead of retrying an unknown command', () => {
    let attempts = 0;
    const runCommand = () => {
      attempts += 1;
      return { status: 1 };
    };

    expect(() =>
      runGeneratedArtifactChecks({
        artifacts: [validArtifact],
        cwd: '/workspace',
        getStatus: () => '',
        runCommand,
      }),
    ).toThrow('failed to generate');
    expect(attempts).toBe(1);
  });

  test('rejects modified or untracked generated output', () => {
    expect(() =>
      runGeneratedArtifactChecks({
        artifacts: [validArtifact],
        cwd: '/workspace',
        getStatus: () => '?? packages/api-client/src/generated/client.ts',
        runCommand: () => ({ status: 0 }),
      }),
    ).toThrow('is stale');
  });
});
