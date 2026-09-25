import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const aliases = require('./aliases.cjs') as Record<string, string>;

export default defineConfig({
  resolve: {
    alias: aliases,
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router',
      'react-router-dom',
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['shared/**/*.test.{ts,tsx}', 'modules/**/*.test.{ts,tsx}'],
  },
});
