module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json', './tsconfig.node.json'],
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh', 'import'],
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
  ignorePatterns: ['node_modules', 'dist', 'coverage', 'current-client', '*.cjs'],
  rules: {
    'import/no-unresolved': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@arsi/shared'],
            message: 'Container must stay self-contained and must not import shared.',
          },
          {
            group: ['@arsi/module-*'],
            message:
              'Container must not import modules outside bootstrap discovery (discover.ts entry imports).',
          },
          {
            group: ['@arsi/extension'],
            message: 'Container imports the extension only in bootstrap discovery (discover.ts).',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['src/bootstrap/discover.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@arsi/shared'],
                message: 'Container must stay self-contained and must not import shared.',
              },
            ],
          },
        ],
      },
    },
  ],
};
