const { spawnSync } = require('node:child_process');
const path = require('node:path');

function validateArtifact(artifact) {
  if (typeof artifact !== 'object' || artifact === null) {
    throw new Error('Each generated artifact must be an object.');
  }

  const { command, id, outputPaths } = artifact;
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) {
    throw new Error('Each generated artifact needs a lowercase kebab-case id.');
  }

  if (
    !Array.isArray(command) ||
    command.length === 0 ||
    command.some((part) => typeof part !== 'string' || part.length === 0)
  ) {
    throw new Error(
      `Generated artifact ${id} needs a non-empty command array.`,
    );
  }

  if (!Array.isArray(outputPaths) || outputPaths.length === 0) {
    throw new Error(`Generated artifact ${id} needs at least one output path.`);
  }

  for (const outputPath of outputPaths) {
    if (
      typeof outputPath !== 'string' ||
      outputPath.length === 0 ||
      path.isAbsolute(outputPath) ||
      outputPath.split(/[\\/]/).includes('..')
    ) {
      throw new Error(`Generated artifact ${id} has an unsafe output path.`);
    }
  }
}

function validateGeneratedArtifacts(artifacts) {
  if (!Array.isArray(artifacts)) {
    throw new Error('generatedArtifacts must be an array.');
  }

  const ids = new Set();
  for (const artifact of artifacts) {
    validateArtifact(artifact);
    if (ids.has(artifact.id)) {
      throw new Error(`Generated artifact id ${artifact.id} is duplicated.`);
    }
    ids.add(artifact.id);
  }
}

function runGeneratedArtifactChecks({ artifacts, cwd, getStatus, runCommand }) {
  validateGeneratedArtifacts(artifacts);

  for (const artifact of artifacts) {
    const [command, ...args] = artifact.command;
    const result = runCommand(command, args, cwd);
    if (result.error || result.status !== 0) {
      throw new Error(`Generated artifact ${artifact.id} failed to generate.`);
    }

    for (const outputPath of artifact.outputPaths) {
      if (getStatus(outputPath, cwd).trim().length > 0) {
        throw new Error(
          `Generated artifact ${artifact.id} is stale at ${outputPath}.`,
        );
      }
    }
  }
}

function runCommand(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
}

function getStatus(outputPath, cwd) {
  const result = spawnSync('git', ['status', '--porcelain', '--', outputPath], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `Could not inspect generated artifact status for ${outputPath}.`,
    );
  }

  return result.stdout;
}

module.exports = {
  getStatus,
  runCommand,
  runGeneratedArtifactChecks,
  validateGeneratedArtifacts,
};
