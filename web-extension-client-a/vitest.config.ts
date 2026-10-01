import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const aliases = require('./aliases.cjs') as Record<string, string>;

// Komponen shared (web-modules) meng-import React dari tree-nya sendiri; pin ke tree
// extension agar hanya ada satu salinan React saat test (menghindari hooks dispatcher null).
const local = (pkg: string) => fileURLToPath(new URL(`./node_modules/${pkg}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react$/, replacement: local('react') },
      { find: /^react-dom$/, replacement: local('react-dom') },
      { find: /^react\/jsx-runtime$/, replacement: local('react/jsx-runtime') },
      { find: /^react\/jsx-dev-runtime$/, replacement: local('react/jsx-dev-runtime') },
      ...Object.entries(aliases).map(([find, replacement]) => ({ find, replacement })),
    ],
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
    include: ['src/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        // Inline agar import React di paket shared/Radix ikut alias di atas (satu salinan React).
        inline: [/@arsi\/shared/, /@radix-ui/, 'lucide-react', 'class-variance-authority'],
      },
    },
  },
});
