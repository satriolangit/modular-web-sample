const preset = require('../web-modules/shared/tailwind.preset.cjs');

const name = process.env.MODULE ?? 'module-runtime-demo';

module.exports = {
  presets: [preset],
  content: [`../runtime-modules/${name}/**/*.{ts,tsx}`],
};
