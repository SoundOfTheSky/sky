module.exports = {
  parserOptions: {
    project: ['tsconfig.json'],
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
    'plugin:unicorn/recommended',
    'plugin:sonarjs/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'prettier/prettier': 1,
    'unicorn/no-null': 0,
    'unicorn/consistent-function-scoping': 0,
    'unicorn/prevent-abbreviations': 0,
    'unicorn/prefer-module': 0,
    'unicorn/prefer-top-level-await': 0,
    'unicorn/no-array-callback-reference': 0,
    'unicorn/no-array-method-this-argument': 0,
    'unicorn/no-useless-undefined': 0,
    'sonarjs/cognitive-complexity': ['error', 20],
    'sonarjs/no-nested-template-literals': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/consistent-type-definitions': [2, 'type'],
  },
};
