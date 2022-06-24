/* eslint-disable max-classes-per-file */
const EnvironmentPlugin = require('webpack/lib/EnvironmentPlugin');
const Plugin = require('../src/Plugin');

class StringifyPlugin {
  constructor(...args) {
    this.values = args;
  }

  apply() {
    return JSON.stringify(this.values);
  }
}

test('is Chainable', () => {
  const parent = { parent: true };
  const plugin = new Plugin(parent);

  expect(plugin.end()).toBe(parent);
});

test('use', () => {
  const plugin = new Plugin();
  const instance = plugin.use(StringifyPlugin, ['alpha', 'beta']);

  expect(instance).toBe(plugin);
  expect(plugin.get('plugin')).toBe(StringifyPlugin);
  expect(plugin.get('args')).toStrictEqual(['alpha', 'beta']);
});

test('tap', () => {
  const plugin = new Plugin();

  plugin.use(StringifyPlugin, ['alpha', 'beta']);

  const instance = plugin.tap(() => ['gamma', 'delta']);

  expect(instance).toBe(plugin);
  expect(plugin.get('args')).toStrictEqual(['gamma', 'delta']);
});

test('init', () => {
  const plugin = new Plugin();

  plugin.use(StringifyPlugin);

  const instance = plugin.init((Plugin, args) => {
    expect(args).toStrictEqual([]);
    return new Plugin('gamma', 'delta');
  });
  const initialized = plugin.get('init')(
    plugin.get('plugin'),
    plugin.get('args'),
  );

  expect(instance).toBe(plugin);
  expect(initialized instanceof StringifyPlugin).toBe(true);
  expect(initialized.values).toStrictEqual(['gamma', 'delta']);
});

test('args is validated as being an array', () => {
  const plugin = new Plugin();

  expect(() => plugin.use(StringifyPlugin, { foo: true })).toThrow(
    'args must be an array of arguments',
  );

  plugin.use(StringifyPlugin);

  expect(() => plugin.tap(() => ({ foo: true }))).toThrow(
    'args must be an array of arguments',
  );
  expect(() => plugin.merge({ args: 5000 })).toThrow(
    'args must be an array of arguments',
  );
  expect(() => plugin.set('args', null)).toThrow(
    'args must be an array of arguments',
  );
});

test('toConfig', () => {
  const plugin = new Plugin(null, 'gamma');

  plugin.use(StringifyPlugin, ['delta']);

  const initialized = plugin.toConfig();

  expect(initialized instanceof StringifyPlugin).toBe(true);
  expect(initialized.values).toStrictEqual(['delta']);
  expect(initialized.__pluginName).toBe('gamma');
  expect(initialized.__pluginType).toBe('plugin');
  expect(initialized.__pluginArgs).toStrictEqual(['delta']);
  expect(initialized.__pluginConstructorName).toBe('StringifyPlugin');
});

test('toConfig with custom type', () => {
  const plugin = new Plugin(null, 'gamma', 'optimization.minimizer');
  plugin.use(StringifyPlugin);

  expect(plugin.toConfig().__pluginType).toBe('optimization.minimizer');
});

test('toConfig with custom expression', () => {
  const plugin = new Plugin(null, 'gamma');

  class TestPlugin {}
  TestPlugin.__expression = `require('my-plugin')`;

  plugin.use(TestPlugin);

  const initialized = plugin.toConfig();

  expect(initialized.__pluginConstructorName).toBe(`(require('my-plugin'))`);
});

test('toConfig with object literal plugin', () => {
  const plugin = new Plugin(null, 'gamma');

  const TestPlugin = {
    apply() {},
  };

  plugin.use(TestPlugin);

  const initialized = plugin.toConfig();

  expect(initialized).toBe(TestPlugin);
});

test('toConfig with plugin as path', () => {
  const plugin = new Plugin(null, 'gamma');
  const envPluginPath = require.resolve('webpack/lib/EnvironmentPlugin');

  plugin.use(envPluginPath);

  const initialized = plugin.toConfig();

  expect(initialized instanceof EnvironmentPlugin).toBe(true);
  expect(initialized.__pluginConstructorName).toBe('EnvironmentPlugin');
  expect(initialized.__pluginPath).toBe(envPluginPath);
});

test('toConfig without having called use()', () => {
  const plugin = new Plugin(null, 'gamma', 'optimization.minimizer');

  expect(() => plugin.toConfig()).toThrow(
    "Invalid optimization.minimizer configuration: optimization.minimizer('gamma').use(<Plugin>) was not called to specify the plugin",
  );
});

test('tap() without having called use()', () => {
  const plugin = new Plugin(null, 'gamma', 'optimization.minimizer');

  expect(() => plugin.tap(() => [])).toThrow(
    "Cannot call .tap() on a plugin that has not yet been defined. Call optimization.minimizer('gamma').use(<Plugin>) first.",
  );
});
