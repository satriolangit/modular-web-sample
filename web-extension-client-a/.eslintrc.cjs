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
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
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
            group: ['@arsi/module-*/entry', '@arsi/module-*/*'],
            message: 'Extensions must import modules only from their public API.',
          },
          {
            group: ['@arsi/extension'],
            message: 'Extensions must not import other extensions.',
          },
          {
            group: ['axios'],
            message: 'Import axios as a value only in init() to register a client-a service.',
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
      files: ['src/index.tsx'],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@arsi/module-*/entry', '@arsi/module-*/*'],
                message: 'Extensions must import modules only from their public API.',
              },
              {
                group: ['@arsi/extension'],
                message: 'Extensions must not import other extensions.',
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
