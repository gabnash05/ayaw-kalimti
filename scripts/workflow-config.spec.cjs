const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { describe, expect, test } = require('@jest/globals');

const checkWorkflowPath = join(__dirname, '../.github/workflows/check.yml');

describe('check workflow configuration', () => {
  test('installs dependencies through the pinned Corepack npm toolchain', () => {
    const workflow = readFileSync(checkWorkflowPath, 'utf8');

    expect(workflow).toContain('run: corepack npm@11.12.1 ci');
    expect(workflow).not.toContain('run: npm ci');
  });
});
