import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react', 'import'],
  categories: {
    correctness: 'error',
    suspicious: 'warn',
    pedantic: 'off',
    perf: 'off',
    style: 'off',
    restriction: 'off',
    nursery: 'off',
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'warn',
    'react/no-unstable-nested-components': [
      'warn',
      {
        allowAsProps: true,
      },
    ],
    'import/no-unassigned-import': 'off',
    'eslint/no-underscore-dangle': 'off',
    'unicorn/no-array-sort': 'off',
    'unicorn/require-module-specifiers': 'off',

    // Native Oxlint rules that cover some of the same ground as anti-slop
    // without requiring a custom plugin or type-aware linting.
    'typescript/consistent-type-assertions': [
      'warn',
      {
        assertionStyle: 'as',
        objectLiteralTypeAssertions: 'never',
        arrayLiteralTypeAssertions: 'never',
      },
    ],
    'typescript/no-empty-object-type': 'warn',
    'typescript/no-unsafe-function-type': 'warn',
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
});
