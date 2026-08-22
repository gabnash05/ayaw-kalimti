const { generatedArtifacts } = require('./generated-artifacts.config.cjs');
const {
  getStatus,
  runCommand,
  runGeneratedArtifactChecks,
} = require('./generated-artifacts.cjs');

try {
  runGeneratedArtifactChecks({
    artifacts: generatedArtifacts,
    cwd: process.cwd(),
    getStatus,
    runCommand,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
