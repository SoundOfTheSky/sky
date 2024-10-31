// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import unusedImports from 'eslint-plugin-unused-imports';
// import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  eslint.configs.recommended,
  eslintPluginPrettierRecommended,
  // sonarjs.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/consistent-type-definitions': [2, 'type'],
      '@typescript-eslint/explicit-member-accessibility': 1,
      '@typescript-eslint/no-misused-promises': 0,
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-unused-vars': 0,
      '@typescript-eslint/prefer-for-of': 0,
      '@typescript-eslint/restrict-template-expressions': [
        1,
        {
          allowNumber: true,
        },
      ],
      '@typescript-eslint/restrict-plus-operands': [
        1,
        {
          allowNumberAndString: true,
        },
      ],
      

      'unused-imports/no-unused-imports': 1,
      'unused-imports/no-unused-vars': [
        1,
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],

      // SonarJS
      // 'sonarjs/new-cap': 0,
    },
  },
);
