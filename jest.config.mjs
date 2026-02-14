export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.mjs$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/__tests__/**/*.mjs'],
  transformIgnorePatterns: [
    'node_modules/(?!(@inquirer)/)',
  ],
};
