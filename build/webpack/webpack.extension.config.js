// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const tsconfig_paths_webpack_plugin_1 = require("tsconfig-paths-webpack-plugin");
const constants_1 = require("../constants");
const common_1 = require("./common");
// tslint:disable-next-line:no-var-requires no-require-imports
const configFileName = path.join(constants_1.ExtensionRootDir, 'tsconfig.extension.json');
// Some modules will be pre-genearted and stored in out/.. dir and they'll be referenced via NormalModuleReplacementPlugin
// We need to ensure they do not get bundled into the output (as they are large).
const existingModulesInOutDir = common_1.getListOfExistingModulesInOutDir();
// tslint:disable-next-line:no-var-requires no-require-imports
const FileManagerPlugin = require('filemanager-webpack-plugin');
const config = {
    mode: 'production',
    target: 'node',
    entry: {
        extension: './src/client/extension.ts'
    },
    devtool: 'source-map',
    node: {
        __dirname: false
    },
    module: {
        rules: [
            {
                // JupyterServices imports node-fetch using `eval`.
                test: /@jupyterlab[\\\/]services[\\\/].*js$/,
                use: [
                    {
                        loader: path.join(__dirname, 'loaders', 'fixEvalRequire.js')
                    }
                ]
            },
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: path.join(__dirname, 'loaders', 'externalizeDependencies.js')
                    }
                ]
            },
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            },
            { enforce: 'post', test: /unicode-properties[\/\\]index.js$/, loader: 'transform-loader?brfs' },
            { enforce: 'post', test: /fontkit[\/\\]index.js$/, loader: 'transform-loader?brfs' },
            { enforce: 'post', test: /linebreak[\/\\]src[\/\\]linebreaker.js/, loader: 'transform-loader?brfs' }
        ]
    },
    externals: [
        'vscode',
        'commonjs',
        ...existingModulesInOutDir
    ],
    plugins: [
        ...common_1.getDefaultPlugins('extension'),
        // Copy pdfkit bits after extension builds. webpack can't handle pdfkit.
        new FileManagerPlugin({
            onEnd: [
                {
                    copy: [
                        { source: './node_modules/fontkit/*.trie', destination: './out/client/node_modules' },
                        { source: './node_modules/pdfkit/js/data/*.*', destination: './out/client/node_modules/data' },
                        { source: './node_modules/pdfkit/js/pdfkit.js', destination: './out/client/node_modules/' }
                    ]
                }
            ]
        })
    ],
    resolve: {
        alias:{
            // Pointing pdfkit to a dummy js file so webpack doesn't fall over.
            // Since pdfkit has been externalized (it gets updated with the valid code by copying the pdfkit files
            // into the right destination).
            'pdfkit':path.resolve(__dirname, 'pdfkit.js')
        },
        extensions: ['.ts', '.js'],
        plugins: [
            new tsconfig_paths_webpack_plugin_1.TsconfigPathsPlugin({ configFile: configFileName })
        ]
    },
    output: {
        filename: '[name].js',
        path: path.resolve(constants_1.ExtensionRootDir, 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};
// tslint:disable-next-line:no-default-export
exports.default = config;
