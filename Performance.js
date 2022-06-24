const Performance = require('../src/Performance');

test('is Chainable', () => {
  const parent = { parent: true };
  const performance = new Performance(parent);

  expect(performance.end()).toBe(parent);
});

test('shorthand methods', () => {
  const performance = new Performance();
  const obj = {};

  performance.shorthands.forEach((method) => {
    obj[method] = 'alpha';
    expect(performance[method]('alpha')).toBe(performance);
  });

  expect(performance.entries()).toStrictEqual(obj);
});
