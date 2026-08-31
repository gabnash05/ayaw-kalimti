const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { describe, expect, test } = require('@jest/globals');

const checkWorkflowPath = join(__dirname, '../.github/workflows/check.yml');
const securityWorkflowPath = join(
  __dirname,
  '../.github/workflows/security.yml',
);

describe('check workflow configuration', () => {
  test('installs dependencies through the pinned Corepack npm toolchain', () => {
    const workflow = readFileSync(checkWorkflowPath, 'utf8');

    expect(workflow).toContain('run: corepack npm@11.12.1 ci');
    expect(workflow).not.toContain('run: npm ci');
  });

  test('runs Docker-backed integration separately and always cleans up', () => {
    const workflow = readFileSync(checkWorkflowPath, 'utf8');

    expect(workflow).toContain('local-integration:');
    expect(workflow).toContain('run: npm run test:local-integration');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('run: npm run local:stop');
  });
});

describe('security workflow configuration', () => {
  test('limits the accepted dependency advisory to the documented exception', () => {
    const workflow = readFileSync(securityWorkflowPath, 'utf8');

    expect(workflow).toContain('allow-ghsas: GHSA-w5hq-g745-h8pq');
    expect(workflow).not.toContain('warn-only: true');
  });
});
