const config = require('../apps/mobile/metro.config.cjs');
const { describe, expect, jest: jestObject, test } = require('@jest/globals');

describe('Metro source resolution', () => {
  test('maps relative JavaScript specifiers to TypeScript source candidates', () => {
    const resolveRequest = jestObject.fn((_context, moduleName, platform) => ({
      moduleName,
      platform,
    }));

    expect(
      config.resolver.resolveRequest(
        { resolveRequest },
        '../src/database/storage-gate.js',
        'android',
      ),
    ).toEqual({
      moduleName: '../src/database/storage-gate',
      platform: 'android',
    });
    expect(resolveRequest).toHaveBeenCalledTimes(1);
  });

  test('preserves explicit JavaScript resolution when no source candidate exists', () => {
    const resolveRequest = jestObject
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('source candidate not found');
      })
      .mockReturnValueOnce({ type: 'sourceFile' });

    expect(
      config.resolver.resolveRequest(
        { resolveRequest },
        './legacy.js',
        'android',
      ),
    ).toEqual({ type: 'sourceFile' });
    expect(
      resolveRequest.mock.calls.map(([, moduleName]) => moduleName),
    ).toEqual(['./legacy', './legacy.js']);
  });

  test('does not rewrite package imports', () => {
    const resolveRequest = jestObject.fn(() => ({ type: 'sourceFile' }));

    config.resolver.resolveRequest(
      { resolveRequest },
      'expo-router/entry.js',
      'android',
    );

    expect(resolveRequest).toHaveBeenCalledWith(
      expect.any(Object),
      'expo-router/entry.js',
      'android',
    );
  });
});
