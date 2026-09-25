module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
    },
  },
  ignorePatterns: ['node_modules', 'dist', 'coverage', '*.cjs', 'vitest.config.ts'],
  rules: {
    'import/no-unresolved': 'off',
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@arsi/module-*'],
            message:
              'Modules must not import other modules. Use the event bus for cross-module communication.',
          },
          {
            group: ['@arsi/extension'],
            message: 'Base layers must not import the client extension.',
          },
          {
            group: ['axios'],
            message: 'Import axios as a value only in a module init() to register a service.',
            allowTypeImports: true,
          },
          {
            group: ['sonner', 'i18next', 'react-i18next', '@tanstack/react-query'],
            message: 'Use the container hooks (@arsi/container) instead of direct library imports.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/index.tsx', '**/index.ts'],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@arsi/module-*'],
                message: 'Modules must not import other modules.',
              },
              {
                group: ['@arsi/extension'],
                message: 'Base layers must not import the client extension.',
              },
              {
                group: ['sonner', 'i18next', 'react-i18next', '@tanstack/react-query'],
                message:
                  'Use the container hooks (@arsi/container) instead of direct library imports.',
              },
            ],
          },
        ],
      },
    },
  ],
};
