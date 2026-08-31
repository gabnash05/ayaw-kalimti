jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sqlite', () => ({}));

import {
  deleteProtectedDatabaseArtifacts,
  PROTECTED_DATABASE_ARTIFACTS,
  ProtectedStorageCleanupError,
  protectedDatabaseExists,
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
  it('reports whether the primary encrypted database exists', () => {
    const { files, factory } = createFiles();
    expect(protectedDatabaseExists('file:///private/databases', factory)).toBe(
      true,
    );
    const database = files.get(PROTECTED_DATABASE_ARTIFACTS[0]);
    if (database === undefined) throw new Error('missing fixture');
    database.exists = false;
    expect(protectedDatabaseExists('file:///private/databases', factory)).toBe(
      false,
    );
  });

  it('fails safely when primary database existence cannot be read', () => {
    expect(() =>
      protectedDatabaseExists('file:///private/databases', () => {
        throw new Error('storage unavailable');
      }),
    ).toThrow(ProtectedStorageCleanupError);
  });

  it('deletes only the fixed database and sidecar names', () => {
    const { files, factory } = createFiles();
    deleteProtectedDatabaseArtifacts('file:///private/databases', factory);
    expect([...files.keys()]).toEqual(PROTECTED_DATABASE_ARTIFACTS);
    for (const file of files.values()) {
      expect(file.delete).toHaveBeenCalledTimes(1);
    }
  });

  it('normalizes the native Android database path to a file URI', () => {
    const { factory } = createFiles();
    const directories: string[] = [];
    deleteProtectedDatabaseArtifacts(
      '/data/user/0/app/files/SQLite',
      (directory, name) => {
        directories.push(directory);
        return factory(directory, name);
      },
    );
    expect(new Set(directories)).toEqual(
      new Set(['file:///data/user/0/app/files/SQLite']),
    );
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

  it('rejects a non-file database directory', () => {
    const { factory } = createFiles();
    expect(() =>
      deleteProtectedDatabaseArtifacts('content://external/database', factory),
    ).toThrow(ProtectedStorageCleanupError);
  });
});
