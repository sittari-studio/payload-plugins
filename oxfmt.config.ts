import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  arrowParens: 'always',
  bracketSpacing: true,
  bracketSameLine: false,
  objectWrap: 'preserve',
  singleAttributePerLine: false,
  endOfLine: 'lf',
  sortPackageJson: false,
  sortTailwindcss: {
    functions: ['clsx', 'cn', 'cva'],
  },
});
