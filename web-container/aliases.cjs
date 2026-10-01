const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');

// Alias modul memakai wildcard — menambah modul baru tidak perlu mengubah file ini.
// PENTING: pola /entry harus di atas pola base (hindari base menangkap "/entry").
module.exports = [
  {
    find: /^@arsi\/module-([^/]+)\/entry$/,
    replacement: path.join(workspaceRoot, 'web-modules', 'modules', '$1', 'index.tsx'),
  },
  {
    find: /^@arsi\/module-([^/]+)$/,
    replacement: path.join(workspaceRoot, 'web-modules', 'modules', '$1', 'public.ts'),
  },
  { find: '@arsi/container', replacement: path.join(__dirname, 'src', 'public', 'index.ts') },
  {
    find: '@arsi/shared',
    replacement: path.join(workspaceRoot, 'web-modules', 'shared', 'index.ts'),
  },
  {
    find: '@arsi/extension',
    replacement: path.join(__dirname, 'current-client', 'src', 'index.tsx'),
  },
];
