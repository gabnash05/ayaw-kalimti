/* global jest */
const { describe, expect, test } = require('@jest/globals');
const {
  PREVIEW_FLAG,
  requirePreviewAuthorization,
  runPreviewTests,
} = require('./preview-tests.cjs');
const apiDefaultConfig = require('../apps/api/jest.config.cjs');
const apiPreviewConfig = require('../apps/api/jest.preview.config.cjs');
const mobileDefaultConfig = require('../apps/mobile/jest.config.cjs');
const toolingDefaultConfig = require('./jest.config.cjs');

describe('preview test authorization', () => {
  test('keeps preview specs out of every default Jest project', () => {
    expect(apiDefaultConfig.testPathIgnorePatterns).toContain(
      '\\.preview\\.spec\\.ts$',
    );
    expect(mobileDefaultConfig.testPathIgnorePatterns).toContain(
      '\\.preview\\.spec\\.[jt]sx?$',
    );
    expect(toolingDefaultConfig.testPathIgnorePatterns).toContain(
      '\\.preview\\.spec\\.cjs$',
    );
    expect(apiPreviewConfig.testMatch).toEqual([
      '<rootDir>/src/**/*.preview.spec.ts',
    ]);
  });

  test('rejects an unapproved preview run with a sanitized error', () => {
    expect(() => requirePreviewAuthorization({})).toThrow(
      'Preview integration tests require explicit preview authorization.',
    );
  });

  test('runs the isolated preview configuration only after authorization', () => {
    const run = jest.fn(() => ({ status: 0 }));

    runPreviewTests({ environment: { [PREVIEW_FLAG]: '1' }, run });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        '--config',
        expect.stringContaining('jest.preview.config.cjs'),
        '--runInBand',
      ]),
    );
  });

  test('reports failure without exposing child-process output', () => {
    const run = jest.fn(() => ({ status: 1 }));

    expect(() =>
      runPreviewTests({ environment: { [PREVIEW_FLAG]: '1' }, run }),
    ).toThrow('Preview integration tests did not pass.');
  });
});
