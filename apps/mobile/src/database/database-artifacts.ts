import { File } from 'expo-file-system';
import { defaultDatabaseDirectory } from 'expo-sqlite';

export const DATABASE_NAME = 'ayaw-kalimti.db';

export const PROTECTED_DATABASE_ARTIFACTS = [
  DATABASE_NAME,
  `${DATABASE_NAME}-journal`,
  `${DATABASE_NAME}-wal`,
  `${DATABASE_NAME}-shm`,
] as const;

interface ArtifactFile {
  readonly exists: boolean;
  delete(): void;
}

export type ArtifactFileFactory = (
  directory: string,
  name: string,
) => ArtifactFile;

export interface DatabaseArtifactStore {
  deleteAll(): void | Promise<void>;
}

export class ProtectedStorageCleanupError extends Error {
  public constructor() {
    super('Protected local storage could not be cleared completely.');
  }
}

const createArtifactFile: ArtifactFileFactory = (directory, name) =>
  new File(directory, name);

function normalizeArtifactDirectory(directory: string): string {
  if (directory.startsWith('file:///')) {
    return directory;
  }
  if (directory.startsWith('/')) {
    return `file://${directory}`;
  }
  throw new ProtectedStorageCleanupError();
}

function isAbsentAfterDeleteFailure(file: ArtifactFile): boolean {
  try {
    return !file.exists;
  } catch {
    return false;
  }
}

export function deleteProtectedDatabaseArtifacts(
  directory: unknown = defaultDatabaseDirectory,
  createFile: ArtifactFileFactory = createArtifactFile,
): void {
  if (typeof directory !== 'string' || directory.length === 0) {
    throw new ProtectedStorageCleanupError();
  }

  const artifactDirectory = normalizeArtifactDirectory(directory);

  let failed = false;
  for (const name of PROTECTED_DATABASE_ARTIFACTS) {
    let file: ArtifactFile | undefined;
    try {
      file = createFile(artifactDirectory, name);
      file.delete();
    } catch {
      if (file === undefined || !isAbsentAfterDeleteFailure(file)) {
        failed = true;
      }
    }
  }

  if (failed) {
    throw new ProtectedStorageCleanupError();
  }
}

export const expoDatabaseArtifactStore: DatabaseArtifactStore = {
  deleteAll: deleteProtectedDatabaseArtifacts,
};
