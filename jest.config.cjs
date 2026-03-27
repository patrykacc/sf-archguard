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
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      diagnostics: { ignoreCodes: [151002] },
    }],
  },
  // Transform the ESM-only apex-parser package through ts-jest
  transformIgnorePatterns: [
    'node_modules/(?!(@apexdevtools/apex-parser|antlr4)/)',
  ],
};
