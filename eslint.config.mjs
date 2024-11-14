// @ts-check
import skyEslintConfig from '@softsky/configs/eslint.config.mjs';

/** @type {import("typescript-eslint").Config} */
export default [
  ...skyEslintConfig,
  {
    rules: {
      'unicorn/no-null': 0,
      'import-x/no-nodejs-modules': 0,
    }
  }
];