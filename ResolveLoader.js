const ResolveLoader = require('../src/ResolveLoader');

test('is Chainable', () => {
  const parent = { parent: true };
  const resolveLoader = new ResolveLoader(parent);

  expect(resolveLoader.end()).toBe(parent);
});

test('shorthand methods', () => {
  const resolveLoader = new ResolveLoader();
  const obj = {};

  resolveLoader.shorthands.forEach((method) => {
    obj[method] = 'alpha';
    expect(resolveLoader[method]('alpha')).toBe(resolveLoader);
  });

  expect(resolveLoader.entries()).toStrictEqual(obj);
});

test('sets methods', () => {
  const resolveLoader = new ResolveLoader();
  const instance = resolveLoader.modules.add('src').end();

  expect(instance).toBe(resolveLoader);
  expect(resolveLoader.toConfig()).toStrictEqual({ modules: ['src'] });
});

test('toConfig empty', () => {
  const resolveLoader = new ResolveLoader();

  expect(resolveLoader.toConfig()).toStrictEqual({});
});

test('toConfig with values', () => {
  const resolveLoader = new ResolveLoader();

  resolveLoader.modules.add('src').end().set('moduleExtensions', ['-loader']);

  expect(resolveLoader.toConfig()).toStrictEqual({
    modules: ['src'],
    moduleExtensions: ['-loader'],
  });
});

test('merge empty', () => {
  const resolveLoader = new ResolveLoader();
  const obj = {
    modules: ['src'],
    moduleExtensions: ['-loader'],
  };
  const instance = resolveLoader.merge(obj);

  expect(instance).toBe(resolveLoader);
  expect(resolveLoader.toConfig()).toStrictEqual(obj);
});

test('merge with values', () => {
  const resolveLoader = new ResolveLoader();

  resolveLoader.modules.add('src').end().moduleExtensions.add('-loader');

  resolveLoader.merge({
    modules: ['dist'],
    moduleExtensions: ['-fake'],
  });

  expect(resolveLoader.toConfig()).toStrictEqual({
    modules: ['src', 'dist'],
    moduleExtensions: ['-loader', '-fake'],
  });
});

test('merge with omit', () => {
  const resolveLoader = new ResolveLoader();

  resolveLoader.modules.add('src').end().moduleExtensions.add('-loader');

  resolveLoader.merge(
    {
      modules: ['dist'],
      moduleExtensions: ['-fake'],
    },
    ['moduleExtensions'],
  );

  expect(resolveLoader.toConfig()).toStrictEqual({
    modules: ['src', 'dist'],
    moduleExtensions: ['-loader'],
  });
});

test('plugin with name', () => {
  const resolveLoader = new ResolveLoader();

  resolveLoader.plugin('alpha');

  expect(resolveLoader.plugins.get('alpha').name).toBe('alpha');
});
