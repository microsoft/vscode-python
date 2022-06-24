const Rule = require('../src/Rule');

test('is Chainable', () => {
  const parent = { parent: true };
  const rule = new Rule(parent);

  expect(rule.end()).toBe(parent);
});

test('shorthand methods', () => {
  const rule = new Rule();
  const obj = {};

  rule.shorthands.forEach((method) => {
    obj[method] = 'alpha';
    expect(rule[method]('alpha')).toBe(rule);
  });

  expect(rule.entries()).toStrictEqual(obj);
});

test('use', () => {
  const rule = new Rule();
  const instance = rule.use('babel').end();

  expect(instance).toBe(rule);
  expect(rule.uses.has('babel')).toBe(true);
});

test('rule', () => {
  const rule = new Rule();
  const instance = rule.rule('babel').end();

  expect(instance).toBe(rule);
  expect(rule.rules.has('babel')).toBe(true);
});

test('oneOf', () => {
  const rule = new Rule();
  const instance = rule.oneOf('babel').end();

  expect(instance).toBe(rule);
  expect(rule.oneOfs.has('babel')).toBe(true);
});

test('resolve', () => {
  const rule = new Rule();
  const instance = rule.resolve.alias.set('foo', 'bar').end().end();

  expect(instance).toBe(rule);
  expect(rule.resolve.alias.has('foo')).toBe(true);
});

test('pre', () => {
  const rule = new Rule();
  const instance = rule.pre();

  expect(instance).toBe(rule);
  expect(rule.get('enforce')).toBe('pre');
});

test('post', () => {
  const rule = new Rule();
  const instance = rule.post();

  expect(instance).toBe(rule);
  expect(rule.get('enforce')).toBe('post');
});

test('sets methods', () => {
  const rule = new Rule();
  const instance = rule.include
    .add('alpha')
    .add('beta')
    .end()
    .exclude.add('alpha')
    .add('beta')
    .end();

  expect(instance).toBe(rule);
  expect(rule.include.values()).toStrictEqual(['alpha', 'beta']);
  expect(rule.exclude.values()).toStrictEqual(['alpha', 'beta']);
});

test('toConfig empty', () => {
  const rule = new Rule();

  expect(rule.toConfig()).toStrictEqual({});
});

test('toConfig with name', () => {
  const parent = new Rule(null, 'alpha');
  const child = parent.oneOf('beta');
  const grandChild = child.oneOf('gamma');
  const ruleChild = parent.rule('delta');

  expect(parent.toConfig().__ruleNames).toStrictEqual(['alpha']);
  expect(parent.toConfig().__ruleTypes).toStrictEqual(['rule']);
  expect(child.toConfig().__ruleNames).toStrictEqual(['alpha', 'beta']);
  expect(child.toConfig().__ruleTypes).toStrictEqual(['rule', 'oneOf']);
  expect(grandChild.toConfig().__ruleNames).toStrictEqual([
    'alpha',
    'beta',
    'gamma',
  ]);
  expect(grandChild.toConfig().__ruleTypes).toStrictEqual([
    'rule',
    'oneOf',
    'oneOf',
  ]);
  expect(ruleChild.toConfig().__ruleNames).toStrictEqual(['alpha', 'delta']);
  expect(ruleChild.toConfig().__ruleTypes).toStrictEqual(['rule', 'rule']);
});

test('toConfig with values', () => {
  const rule = new Rule();

  rule.include
    .add('alpha')
    .add('beta')
    .end()
    .exclude.add('alpha')
    .add('beta')
    .end()
    .post()
    .pre()
    .test(/\.js$/)
    .use('babel')
    .loader('babel-loader')
    .options({ presets: ['alpha'] })
    .end()
    .rule('minifier')
    .resourceQuery(/minify/)
    .use('minifier')
    .loader('minifier-loader')
    .end()
    .end()
    .oneOf('inline')
    .resourceQuery(/inline/)
    .use('url')
    .loader('url-loader');

  expect(rule.toConfig()).toStrictEqual({
    test: /\.js$/,
    enforce: 'pre',
    include: ['alpha', 'beta'],
    exclude: ['alpha', 'beta'],
    rules: [
      {
        resourceQuery: /minify/,
        use: [
          {
            loader: 'minifier-loader',
          },
        ],
      },
    ],
    oneOf: [
      {
        resourceQuery: /inline/,
        use: [
          {
            loader: 'url-loader',
          },
        ],
      },
    ],
    use: [
      {
        loader: 'babel-loader',
        options: {
          presets: ['alpha'],
        },
      },
    ],
  });
});

test('toConfig with test function', () => {
  const rule = new Rule();
  const test = (s) => s.includes('.js');

  rule.test(test);

  expect(rule.toConfig()).toStrictEqual({ test });
});

test('merge empty', () => {
  const rule = new Rule();
  const obj = {
    enforce: 'pre',
    test: /\.js$/,
    include: ['alpha', 'beta'],
    exclude: ['alpha', 'beta'],
    rules: {
      minifier: {
        resourceQuery: /minify/,
        use: {
          minifier: {
            loader: 'minifier-loader',
          },
        },
      },
    },
    oneOf: {
      inline: {
        resourceQuery: /inline/,
        use: {
          url: {
            loader: 'url-loader',
          },
        },
      },
    },
    use: {
      babel: {
        loader: 'babel-loader',
        options: {
          presets: ['alpha'],
        },
      },
    },
  };
  const instance = rule.merge(obj);

  expect(instance).toBe(rule);
  expect(rule.toConfig()).toStrictEqual({
    enforce: 'pre',
    test: /\.js$/,
    include: ['alpha', 'beta'],
    exclude: ['alpha', 'beta'],
    rules: [
      {
        resourceQuery: /minify/,
        use: [
          {
            loader: 'minifier-loader',
          },
        ],
      },
    ],
    oneOf: [
      {
        resourceQuery: /inline/,
        use: [
          {
            loader: 'url-loader',
          },
        ],
      },
    ],
    use: [
      {
        loader: 'babel-loader',
        options: {
          presets: ['alpha'],
        },
      },
    ],
  });
});

test('merge with values', () => {
  const rule = new Rule();

  rule
    .test(/\.js$/)
    .post()
    .include.add('gamma')
    .add('delta')
    .end()
    .use('babel')
    .loader('babel-loader')
    .options({ presets: ['alpha'] });

  rule.merge({
    test: /\.jsx$/,
    enforce: 'pre',
    include: ['alpha', 'beta'],
    exclude: ['alpha', 'beta'],
    rules: {
      minifier: {
        resourceQuery: /minify/,
        use: {
          minifier: {
            loader: 'minifier-loader',
          },
        },
      },
    },
    oneOf: {
      inline: {
        resourceQuery: /inline/,
        use: {
          url: {
            loader: 'url-loader',
          },
        },
      },
    },
    use: {
      babel: {
        options: {
          presets: ['beta'],
        },
      },
    },
  });

  expect(rule.toConfig()).toStrictEqual({
    test: /\.jsx$/,
    enforce: 'pre',
    include: ['gamma', 'delta', 'alpha', 'beta'],
    exclude: ['alpha', 'beta'],
    rules: [
      {
        resourceQuery: /minify/,
        use: [
          {
            loader: 'minifier-loader',
          },
        ],
      },
    ],
    oneOf: [
      {
        resourceQuery: /inline/,
        use: [
          {
            loader: 'url-loader',
          },
        ],
      },
    ],
    use: [
      {
        loader: 'babel-loader',
        options: {
          presets: ['alpha', 'beta'],
        },
      },
    ],
  });
});

test('merge with omit', () => {
  const rule = new Rule();

  rule
    .test(/\.js$/)
    .post()
    .include.add('gamma')
    .add('delta')
    .end()
    .use('babel')
    .loader('babel-loader')
    .options({ presets: ['alpha'] });

  rule.merge(
    {
      test: /\.jsx$/,
      enforce: 'pre',
      include: ['alpha', 'beta'],
      exclude: ['alpha', 'beta'],
      rules: {
        minifier: {
          resourceQuery: /minify/,
          use: {
            minifier: {
              loader: 'minifier-loader',
            },
          },
        },
      },
      oneOf: {
        inline: {
          resourceQuery: /inline/,
          use: {
            url: {
              loader: 'url-loader',
            },
          },
        },
      },
      use: {
        babel: {
          options: {
            presets: ['beta'],
          },
        },
      },
    },
    ['use', 'oneOf', 'rules'],
  );

  expect(rule.toConfig()).toStrictEqual({
    test: /\.jsx$/,
    enforce: 'pre',
    include: ['gamma', 'delta', 'alpha', 'beta'],
    exclude: ['alpha', 'beta'],
    use: [
      {
        loader: 'babel-loader',
        options: {
          presets: ['alpha'],
        },
      },
    ],
  });
});

test('merge with include and exclude not of array type', () => {
  const rule = new Rule();

  rule.merge({
    test: /\.jsx$/,
    include: 'alpha',
    exclude: 'alpha',
  });

  expect(rule.toConfig()).toStrictEqual({
    test: /\.jsx$/,
    include: ['alpha'],
    exclude: ['alpha'],
  });
});

test('merge with resolve', () => {
  const rule = new Rule();

  rule.merge({
    resolve: {
      alias: { foo: 'bar' },
    },
  });

  rule.merge({
    resolve: {
      extensions: ['.js', '.mjs'],
    },
  });

  expect(rule.toConfig()).toStrictEqual({
    resolve: {
      alias: { foo: 'bar' },
      extensions: ['.js', '.mjs'],
    },
  });
});

test('ordered rules', () => {
  const rule = new Rule();
  rule
    .rule('first')
    .test(/\.first$/)
    .end()
    .rule('second')
    .test(/\.second$/)
    .end()
    .rule('third')
    .test(/\.third$/)
    .end()
    .rule('alpha')
    .test(/\.alpha$/)
    .before('first')
    .end()
    .rule('beta')
    .test(/\.beta$/)
    .after('second');

  expect(rule.toConfig().rules.map((o) => o.test)).toStrictEqual([
    /\.alpha$/,
    /\.first$/,
    /\.second$/,
    /\.beta$/,
    /\.third$/,
  ]);
});

test('ordered oneOfs', () => {
  const rule = new Rule();
  rule
    .oneOf('first')
    .test(/\.first$/)
    .end()
    .oneOf('second')
    .test(/\.second$/)
    .end()
    .oneOf('third')
    .test(/\.third$/)
    .end()
    .oneOf('alpha')
    .test(/\.alpha$/)
    .before('first')
    .end()
    .oneOf('beta')
    .test(/\.beta$/)
    .after('second');

  expect(rule.toConfig().oneOf.map((o) => o.test)).toStrictEqual([
    /\.alpha$/,
    /\.first$/,
    /\.second$/,
    /\.beta$/,
    /\.third$/,
  ]);
});
