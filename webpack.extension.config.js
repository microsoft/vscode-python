const path = require("path");
const nodeExternals = require("webpack-node-externals");
const configFileName = 'tsconfig.extension.json';
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer")
    .BundleAnalyzerPlugin;
const webpack = require("webpack");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

// const extensionTools = require('./build/webpack/extension');

// const nodeModuleBundleEntries = extensionTools.getNodeModuleBunleEntries();
// const exteranlSourceLoaderOptions = extensionTools.getExternalSourceLoaderOptions();
// const exteranlSourceToIgnore = extensionTools.getExternalSourcesToIgnore();

// console.log(exteranlSourceToIgnore);
module.exports = {
    mode: "production",
    target: "node",
    entry: {
        extension: "./src/client/extension.ts",
        debugAdapter: "./src/client/debugger/debugAdapter/main.ts"
        // ...nodeModuleBundleEntries,
        // "untildifyx": "untildify"
        // unicode_category_Lu: './node_modules/unicode/category/Lu.js',
        // unicode_category_Ll: './node_modules/unicode/category/Ll.js',
        // unicode_category_Lt: './node_modules/unicode/category/Lt.js',
        // unicode_category_Lo: './node_modules/unicode/category/Lo.js',
        // unicode_category_Nl: './node_modules/unicode/category/Nl.js',
        // unicode_category_Mn: './node_modules/unicode/category/Mn.js',
        // unicode_category_Mcc: './node_modules/unicode/category/Mc.js',
        // unicode_category_Nd: './node_modules/unicode/category/Nd.js',
        // unicode_category_Pc: './node_modules/unicode/category/Pc.js'
    },
    devtool: 'source-map',
    // devtool: "none",
    node: {
        __dirname: false
    },
    // resolveLoader: {
    //     alias: {
    //         'unicode/category/Lu': path.join(__dirname, 'out', 'client', 'unicode_category_Lu.js'),
    //         'unicode/category/Lu$': path.join(__dirname, 'out', 'client', 'unicode_category_Lu.js'),
    //     }
    // },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader"
                    }
                    // {
                    //     loader: '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/myloader.js'
                    // }
                ]
            }
            // {
            //     test: /\.ts$/,
            //     use: [
            //         {
            //             loader: './build/webpack/externalSourceLoader.js',
            //             options: exteranlSourceLoaderOptions
            //         }]
            // },
            // {
            //     test: /\.ts$/,
            //     use: {
            //         loader: "awesome-typescript-loader",
            //         options: {
            //             configFileName,
            //             reportFiles: [
            //                 'src/datascience-ui/**/*.{ts,tsx}'
            //             ]
            //         },
            //     }
            // },
            // {
            //     test: /\.json$/,
            //     type: 'javascript/auto',
            //     include: /node_modules.*remark.*/,
            //     use: [
            //         {
            //             loader: path.resolve('./build/datascience/jsonloader.js'),
            //             options: {}
            //         }
            //     ]
            // }
        ]
    },
    plugins: [
        new BundleAnalyzerPlugin({
            analyzerMode: "static"
        })
        // new webpack.HashedModuleIdsPlugin(), // so that file hashes don't change unexpectedly
        // new webpack.optimize.CommonsChunkPlugin({
        //     name: 'node-static',
        //     filename: 'node-static.js',
        //     minChunks(module, count) {
        //         var context = module.context;
        //         return context && context.indexOf('node_modules') >= 0;
        //     },
        // }),
    ],
    optimization: {
        // runtimeChunk: 'single',
        // splitChunks: {
        //     cacheGroups: {
        //         commons: {
        //             test: /[\\/]node_modules[\\/]/,
        //             name: "vendors",
        //             chunks: "async"
        //         },
        //         wow: {
        //             test: /[\\/]node_modules[\\/]/,
        //             name: "wow",
        //             chunks: "initial"
        //         }
        //     }
        // }
        // splitChunks: {
        //     chunks: 'all',
        //     maxInitialRequests: Infinity,
        //     minSize: 0,
        //     cacheGroups: {
        //         vendor: {
        //             test: /[\\/]node_modules[\\/]/,
        //             name(module) {
        //                 // get the name. E.g. node_modules/packageName/not/this/part.js
        //                 // or node_modules/packageName
        //                 const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
        //                  // npm package names are URL-safe, but some servers don't like @ symbols
        //                 return `npm.${packageName.replace('@', '')}`;
        //             }
        //         }
        //     }
        // }
    },
    // externals: [nodeExternals(), 'vscode'],
    // externals: ["commonjs", "vscode"],
    externals: [
        "vscode",
        "commonjs",
        // "lodash",
        // "azure-storage",
        // "vscode-extension-telemetry",
        // "@jupyterlab/services",
        // // "unicode",
        "unicode/category/Lu", "unicode/category/Ll", "unicode/category/Lt",
        "unicode/category/Lo", "unicode/category/Lo", "unicode/category/Lm",
        "unicode/category/Nl", "unicode/category/Mn", "unicode/category/Mc",
        "unicode/category/Nd", "unicode/category/Pc",

        "out/unicode/category/Lu", "out/unicode/category/Ll", "out/unicode/category/Lt",
        "out/unicode/category/Lo", "out/unicode/category/Lo", "out/unicode/category/Lm",
        "out/unicode/category/Nl", "out/unicode/category/Mn", "out/unicode/category/Mc",
        "out/unicode/category/Nd", "out/unicode/category/Pc",

        "./out/unicode/category/Lu", "./out/unicode/category/Ll", "./out/unicode/category/Lt",
        "./out/unicode/category/Lo", "./out/unicode/category/Lo", "./out/unicode/category/Lm",
        "./out/unicode/category/Nl", "./out/unicode/category/Mn", "./out/unicode/category/Mc",
        "./out/unicode/category/Nd", "./out/unicode/category/Pc",

        "./out/unicode/category/Lu.js", "./out/unicode/category/Ll.js", "./out/unicode/category/Lt.js",
        "./out/unicode/category/Lo.js", "./out/unicode/category/Lo.js", "./out/unicode/category/Lm.js",
        "./out/unicode/category/Nl.js", "./out/unicode/category/Mn.js", "./out/unicode/category/Mc.js",
        "./out/unicode/category/Nd.js", "./out/unicode/category/Pc.js",

        // 'out/client/unicode_category_Llxyz.js',
        // './out/client/unicode_category_Llxyz.js',
        // './out/client/HELLO.js',
        // 'out/client/unicode_category_Lu.js',
        // ...exteranlSourceToIgcnore

        // path.join(__dirname, 'out', 'client', 'unicode_category_Lu'),
        // path.join(__dirname, 'out', 'client', 'unicode_category_Lu.js'),
    ],
    // externals: 'commonjs vscode',
    // externals: {
    //     vscode: "commonjs vscode" // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed
    // },
    resolve: {
        extensions: [".ts", ".js"],
        // plugins: [new TsconfigPathsPlugin({ configFile: configFileName })],
        alias: {
            'unicode/category/Lu$': 'out/client/unicode_category_Lu.js',
            'unicode/category/Lu': 'out/client/unicode_category_Lu.js',
            // 'unicode/category/Lu$': path.join(__dirname, 'out', 'client', 'unicode_category_Lu.js'),
            // 'unicode/category/Lu': path.join(__dirname, 'out', 'client', 'unicode_category_Lu.js'),
        }
    },
    output: {
        // filename: 'index.js',c
        filename: "[name].js",
        // chunkFilename: '[name].bundle.js',
        path: path.resolve(__dirname, "out", "client"),
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    }
};
