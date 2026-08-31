const { spawnSync } = require('node:child_process');
const path = require('node:path');

const PREVIEW_FLAG = 'AYAW_KALIMTI_PREVIEW_INTEGRATION';

function requirePreviewAuthorization(environment = process.env) {
  if (environment[PREVIEW_FLAG] !== '1') {
    throw new Error(
      'Preview integration tests require explicit preview authorization.',
    );
  }
}

function runPreviewTests({ environment = process.env, run = spawnSync } = {}) {
  requirePreviewAuthorization(environment);

  const repositoryRoot = path.resolve(__dirname, '..');
  const result = run(
    process.execPath,
    [
      path.join(repositoryRoot, 'node_modules/jest/bin/jest.js'),
      '--config',
      path.join(repositoryRoot, 'apps/api/jest.preview.config.cjs'),
      '--runInBand',
    ],
    {
      cwd: repositoryRoot,
      env: environment,
      stdio: 'inherit',
    },
  );

  if (result.error || result.status !== 0) {
    throw new Error('Preview integration tests did not pass.');
  }
}

if (require.main === module) {
  try {
    runPreviewTests();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { PREVIEW_FLAG, requirePreviewAuthorization, runPreviewTests };
