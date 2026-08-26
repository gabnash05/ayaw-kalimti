jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sqlite', () => ({}));

import {
  deleteProtectedDatabaseArtifacts,
  PROTECTED_DATABASE_ARTIFACTS,
  ProtectedStorageCleanupError,
  type ArtifactFileFactory,
} from './database-artifacts.js';

interface FakeFile {
  exists: boolean;
  delete: jest.Mock<void, []>;
}

const createFiles = (): {
  files: Map<string, FakeFile>;
  factory: ArtifactFileFactory;
} => {
  const files = new Map<string, FakeFile>();
  for (const name of PROTECTED_DATABASE_ARTIFACTS) {
    files.set(name, {
      exists: true,
      delete: jest.fn(function (this: FakeFile) {
        this.exists = false;
      }),
    });
  }
  return {
    files,
    factory: (_directory, name) => {
      const file = files.get(name);
      if (file === undefined) throw new Error('unexpected artifact');
      return file;
    },
  };
};

describe('protected database artifacts', () => {
  it('deletes only the fixed database and sidecar names', () => {
    const { files, factory } = createFiles();
    deleteProtectedDatabaseArtifacts('file:///private/databases', factory);
    expect([...files.keys()]).toEqual(PROTECTED_DATABASE_ARTIFACTS);
    for (const file of files.values()) {
      expect(file.delete).toHaveBeenCalledTimes(1);
    }
  });

  it('is idempotent when an artifact is already absent', () => {
    const { files, factory } = createFiles();
    const journal = files.get(PROTECTED_DATABASE_ARTIFACTS[1]);
    if (journal === undefined) throw new Error('missing fixture');
    journal.exists = false;
    journal.delete.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(() =>
      deleteProtectedDatabaseArtifacts('file:///private/databases', factory),
    ).not.toThrow();
  });

  it('attempts every artifact and reports a persistent deletion failure', () => {
    const { files, factory } = createFiles();
    const database = files.get(PROTECTED_DATABASE_ARTIFACTS[0]);
    if (database === undefined) throw new Error('missing fixture');
    database.delete.mockImplementation(() => {
      throw new Error('permission denied');
    });
    expect(() =>
      deleteProtectedDatabaseArtifacts('file:///private/databases', factory),
    ).toThrow(ProtectedStorageCleanupError);
    for (const file of files.values()) {
      expect(file.delete).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects a missing application-private database directory', () => {
    const { factory } = createFiles();
    expect(() => deleteProtectedDatabaseArtifacts(undefined, factory)).toThrow(
      ProtectedStorageCleanupError,
    );
  });
});
