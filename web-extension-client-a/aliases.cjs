const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');

module.exports = {
  '@arsi/container': path.join(workspaceRoot, 'web-container', 'src', 'public', 'index.ts'),
  '@arsi/shared': path.join(workspaceRoot, 'web-modules', 'shared', 'index.ts'),
  '@arsi/module-user-management': path.join(
    workspaceRoot,
    'web-modules',
    'modules',
    'user-management',
    'public.ts',
  ),
};
