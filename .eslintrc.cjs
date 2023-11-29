module.exports = {
  parserOptions: {
    project: ['tsconfig.json'],
  },
  plugins: ["unused-imports"],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
    'plugin:sonarjs/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'prettier/prettier': 1,
    'sonarjs/cognitive-complexity': ['error', 20],
    'sonarjs/no-nested-template-literals': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/no-misused-promises': 0,
    '@typescript-eslint/consistent-type-definitions': [2, 'type'],
    '@typescript-eslint/no-unused-vars': 0,
    'unused-imports/no-unused-imports': 2,
    'unused-imports/no-unused-vars': [
      1,
      { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
    ],
  },
};
