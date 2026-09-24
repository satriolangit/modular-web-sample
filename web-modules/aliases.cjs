const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');

module.exports = {
  '@arsi/module-user-management/entry': path.join(
    __dirname,
    'modules',
    'user-management',
    'index.tsx',
  ),
  '@arsi/module-user-management': path.join(
    __dirname,
    'modules',
    'user-management',
    'public.ts',
  ),
  '@arsi/module-product-management/entry': path.join(
    __dirname,
    'modules',
    'product-management',
    'index.tsx',
  ),
  '@arsi/module-product-management': path.join(
    __dirname,
    'modules',
    'product-management',
    'public.ts',
  ),
  '@arsi/container': path.join(workspaceRoot, 'web-container', 'src', 'public', 'index.ts'),
  '@arsi/shared': path.join(__dirname, 'shared', 'index.ts'),
};
