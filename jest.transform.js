const { createTransformer } = require('babel-jest');

let presetEnvPath = null;
try {
  // Resolve relative to this config so jest does not crash when the preset is optional.
  presetEnvPath = require.resolve('@babel/preset-env');
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('[jest] @babel/preset-env missing – falling back to native Node transforms');
}

const optionalPlugins = [];
for (const pluginName of [
  '@babel/plugin-proposal-class-properties',
  '@babel/plugin-proposal-optional-chaining',
  '@babel/plugin-transform-modules-commonjs',
]) {
  try {
    optionalPlugins.push(require.resolve(pluginName));
  } catch (error) {
    // Plugin not installed; Node 18+ already supports the syntax used in the codebase.
  }
}

module.exports = createTransformer({
  babelrc: false,
  configFile: false,
  presets: presetEnvPath
    ? [[presetEnvPath, { targets: { node: 'current' }, bugfixes: true }]]
    : [],
  plugins: optionalPlugins,
});
