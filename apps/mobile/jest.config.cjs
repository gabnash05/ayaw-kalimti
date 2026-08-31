module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  testPathIgnorePatterns: ['\\.preview\\.spec\\.[jt]sx?$'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
