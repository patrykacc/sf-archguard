module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Transform the ESM-only apex-parser package through ts-jest
  transformIgnorePatterns: [
    'node_modules/(?!(@apexdevtools/apex-parser|antlr4)/)',
  ],
  globals: {
    'ts-jest': {
      useESM: true,
      diagnostics: { ignoreCodes: [151002] },
    },
  },
};
