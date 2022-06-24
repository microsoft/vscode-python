/**
 * Notes: The order structure of the type check follows the order
 * of this document: https://github.com/neutrinojs/webpack-chain#config
 */
import Resolver = require('enhanced-resolve/lib/Resolver');
import Config = require('webpack-chain');
import * as webpack from 'webpack';

class ResolvePluginImpl extends webpack.ResolvePlugin {
  apply(resolver: Resolver): void {}
}

function expectType<T>(value: T) {}

const config = new Config();

config
  .amd({ foo: true })
  .bail(true)
  .cache(false)
  .cache({})
  .devtool('hidden-source-map')
  .devtool(false)
  .context('')
  .externals('foo')
  .externals(/node_modules/)
  .externals({ test: false, foo: 'bar' })
  .externals(['foo', 'bar'])
  .externals((context, request, cb) => cb(null, 'foo'))
  .loader({})
  .name('config-name')
  .mode('none')
  .mode('development')
  .mode('production')
  .profile(false)
  .parallelism(2)
  .recordsPath('')
  .recordsInputPath('')
  .recordsOutputPath('')
  .stats({
    assets: false,
    publicPath: true,
    modules: false,
  })
  .target('web')
  .watch(true)
  .watchOptions({})
  .when(
    false,
    (config) => config.watch(true),
    (config) => config.watch(false),
  )

  .entry('main')
  .add('index.js')
  .delete('index.js')
  .clear()
  .when(
    false,
    (entry) => entry.clear(),
    (entry) => entry.clear(),
  )
  .end()

  .entryPoints.delete('main')
  .end()

  .output.futureEmitAssets(true)
  .auxiliaryComment('Test Comment')
  .auxiliaryComment({
    root: 'Root Comment',
  })
  .chunkFilename('')
  .chunkLoadTimeout(1000)
  .crossOriginLoading(true)
  .devtoolFallbackModuleFilenameTemplate('')
  .devtoolNamespace('')
  .devtoolLineToLine('')
  .devtoolModuleFilenameTemplate('')
  .filename('main.js')
  .globalObject('global')
  .hashFunction('md5')
  .hashDigest('md5')
  .hashDigestLength(15)
  .hashSalt('')
  .hotUpdateChunkFilename('update')
  .hotUpdateFunction(() => {})
  .hotUpdateMainFilename('main')
  .jsonpFunction('callback')
  .library('var')
  .libraryExport(['MyModule', 'MySubModule'])
  .libraryTarget('var')
  .path('/')
  .pathinfo(true)
  .publicPath('/')
  .sourceMapFilename('index.js.map')
  .sourcePrefix('~')
  .strictModuleExceptionHandling(true)
  .umdNamedDefine(true)
  .end()

  .resolve.cachePredicate(({ path, request }) => true)
  .cacheWithContext(true)
  .enforceExtension(true)
  .enforceModuleExtension(true)
  .unsafeCache(false)
  .unsafeCache(/foo/)
  .symlinks(true)
  .alias.set('foo', 'bar')
  .end()
  .modules.add('index.js')
  .end()
  .aliasFields.add('foo')
  .end()
  .descriptionFiles.add('foo')
  .end()
  .extensions.add('.js')
  .end()
  .mainFields.add('browser')
  .end()
  .mainFiles.add('index.js')
  .end()
  .plugin('foo')
  .use(ResolvePluginImpl, [])
  .end()
  .plugins.delete('foo')
  .end()
  .end()

  .resolveLoader.moduleExtensions.add('.js')
  .end()
  .packageMains.add('index.js')
  .end()
  .plugin('foo')
  .use(webpack.DefinePlugin)
  .end()
  .end()

  .performance.hints(true)
  .hints('warning')
  .maxEntrypointSize(20000)
  .maxAssetSize(20000)
  .assetFilter((filename) => true)
  .end()

  .optimization.concatenateModules(true)
  .flagIncludedChunks(true)
  .mergeDuplicateChunks(true)
  .minimize(true)
  .namedChunks(true)
  .namedModules(true)
  .nodeEnv(true)
  .noEmitOnErrors(true)
  .occurrenceOrder(true)
  .portableRecords(true)
  .providedExports(true)
  .removeAvailableModules(true)
  .removeEmptyChunks(true)
  .runtimeChunk('single')
  .runtimeChunk({ name: ({}) => 'hello' })
  .sideEffects(true)
  .splitChunks({})
  .usedExports(true)
  .minimizer('foo')
  .use(webpack.DefinePlugin)
  .tap((config) => [])
  .end()
  .end()

  .plugin('foo')
  .use(webpack.DefinePlugin, [
    {
      'process.env.NODE_ENV': '',
    },
  ])
  .end()

  .plugin('bar')
  .use(webpack.DefinePlugin, [
    {
      'process.env.NODE_ENV': '',
    },
  ])
  .before('foo')
  .end()

  .plugin('baz')
  .use(webpack.DefinePlugin, [
    {
      'process.env.NODE_ENV': '',
    },
  ])
  .after('bar')
  .end()

  .plugin('asString')
  .use('package-name-or-path')
  .end()

  .plugin('asObject')
  .use({ apply: (compiler: webpack.Compiler) => {} })
  .end()

  .plugins.delete('foo')
  .delete('bar')
  .delete('baz')
  .delete('asString')
  .delete('asObject')
  .end()

  .node.set('__dirname', true)
  .delete('__dirname')
  .clear()
  .end()

  .devServer.allowedHosts.add('host.com')
  .clear()
  .end()
  .after(() => {})
  .before(() => {})
  .bonjour(true)
  .clientLogLevel('error')
  .color(true)
  .compress(false)
  .contentBase('/')
  .contentBase(['foo', 'bar'])
  .disableHostCheck(true)
  .filename('hello')
  .headers({
    'Content-Type': 'text/css',
  })
  .historyApiFallback(true)
  .host('localhost')
  .hot(true)
  .hotOnly(true)
  .http2(true)
  .https(true)
  .index('test.html')
  .info(true)
  .inline(true)
  .lazy(true)
  .mimeTypes({ 'text/html': ['phtml'] })
  .noInfo(true)
  .open(true)
  .openPage('/foo')
  .openPage(['/foo', '/bar'])
  .overlay(true)
  .overlay({
    warnings: true,
    errors: true,
  })
  .pfx('/path/to/file.pfx')
  .pfxPassphrase('passphrase')
  .port(8080)
  .progress(true)
  .proxy({})
  .public('foo')

  .publicPath('bar')
  .quiet(false)
  .setup((app) => {})
  .socket('socket')
  .sockHost('localhost')
  .sockPath('/sockpath/')
  .sockPort(8080)
  .staticOptions({})
  .stats({
    reasons: true,
    errors: true,
    warnings: false,
  })
  .stdin(true)
  .useLocalIp(true)
  .watchContentBase(true)
  .watchOptions({})
  .writeToDisk(true)
  .end()

  .module.noParse(/.min.js$/)
  .strictExportPresence(true)
  .rule('compile')
  .test(/.js$/)
  .include.add(/.js$/)
  .end()
  .exclude.add(/node_modules/)
  .end()
  .parser({
    opt: 'foo',
  })
  .enforce('pre')
  .use('babel')
  .tap((config) => [])
  .loader('babel-loader')
  .options({})
  .end()
  .use('eslint')
  .loader('eslint-loader')
  .options({})
  .after('babel')
  .end()
  .uses.delete('babel')
  .delete('eslint')
  .end()
  .pre()
  .post()
  .rule('inline')
  .after('vue')
  .resourceQuery(/inline/)
  .use('url')
  .loader('url-loader')
  .end()
  .resolve.symlinks(true)
  .end()
  .end()
  .rules.delete('inline')
  .end()
  .oneOf('inline')
  .after('vue')
  .uses.delete('babel')
  .end()
  .resourceQuery(/inline/)
  .use('url')
  .loader('url-loader')
  .end()
  .end()
  .oneOfs.delete('inline')
  .end()
  .resolve.symlinks(true)
  .end()
  .end()
  .rules.delete('compile')
  .end()
  .end()

  //** support https://webpack.js.org/configuration/module/#ruletype  */
  .module.rule('mjs-compile')
  .test(/\.mjs$/)
  .type('javascript/auto')
  .end()
  .end()

  .merge({})
  .toConfig();

// Test TypedChainedMap
const entryPoints = config.entryPoints;

expectType<typeof entryPoints>(entryPoints.clear());
expectType<typeof entryPoints>(entryPoints.delete('key'));
expectType<boolean>(entryPoints.has('key'));
expectType<Config.EntryPoint>(entryPoints.get('key'));
expectType<Config.EntryPoint>(
  entryPoints.getOrCompute('key', () => new Config.EntryPoint()),
);
expectType<typeof entryPoints>(entryPoints.set('key', new Config.EntryPoint()));
expectType<typeof entryPoints>(
  entryPoints.merge({
    key: new Config.EntryPoint(),
  }),
);
expectType<Record<string, Config.EntryPoint>>(entryPoints.entries());
expectType<typeof entryPoints>(
  entryPoints.when(
    true,
    (val) => {
      expectType<typeof entryPoints>(val);
    },
    (val) => {
      expectType<typeof entryPoints>(val);
    },
  ),
);

// Test TypedChainedSet
const extensions = config.resolve.extensions;

expectType<typeof extensions>(extensions.add('.txt'));
expectType<typeof extensions>(extensions.prepend('.txt'));
expectType<typeof extensions>(extensions.clear());
expectType<typeof extensions>(extensions.delete('.txt'));
expectType<boolean>(extensions.has('.txt'));
expectType<typeof extensions>(extensions.merge(['.txt']));
expectType<string[]>(extensions.values());
expectType<typeof extensions>(
  extensions.when(
    true,
    (val) => {
      expectType<typeof extensions>(val);
    },
    (val) => {
      expectType<typeof extensions>(val);
    },
  ),
);
