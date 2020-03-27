// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

const copyWebpackPlugin = require('copy-webpack-plugin');
const removeFilesWebpackPlugin = require('remove-files-webpack-plugin');
const path = require('path');
const tsconfig_paths_webpack_plugin = require('tsconfig-paths-webpack-plugin');
const constants = require('../constants');
const common = require('./common');
// tslint:disable-next-line:no-var-requires no-require-imports
const configFileName = path.join(constants.ExtensionRootDir, 'tsconfig.extension.json');
// Some modules will be pre-genearted and stored in out/.. dir and they'll be referenced via NormalModuleReplacementPlugin
// We need to ensure they do not get bundled into the output (as they are large).
const existingModulesInOutDir = common.getListOfExistingModulesInOutDir();
// tslint:disable-next-line:no-var-requires no-require-imports
const FileManagerPlugin = require('filemanager-webpack-plugin');
// If ENABLE_GATHER variable is defined, don't exclude the python-program-analysis pacakge.
// See externals, below.
const ppaPackageList = process.env.ENABLE_GATHER ? [] : ['@msrvida/python-program-analysis'];
const config = {
    mode: 'production',
    target: 'node',
    entry: {
        extension: './src/client/extension.ts',
    },
    devtool: 'source-map',
    node: {
        __dirname: false,
    },
    module: {
        rules: [
            {
                // JupyterServices imports node-fetch.
                test: /@jupyterlab[\\\/]services[\\\/].*js$/,
                use: [
                    {
                        loader: path.join(__dirname, 'loaders', 'fixNodeFetch.js'),
                    },
                ],
            },
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: path.join(__dirname, 'loaders', 'externalizeDependencies.js'),
                    },
                ],
            },
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                    },
                ],
            },
            { enforce: 'post', test: /unicode-properties[\/\\]index.js$/, loader: 'transform-loader?brfs' },
            { enforce: 'post', test: /fontkit[\/\\]index.js$/, loader: 'transform-loader?brfs' },
            { enforce: 'post', test: /linebreak[\/\\]src[\/\\]linebreaker.js/, loader: 'transform-loader?brfs' },
        ],
    },
    // Packages listed in externals keeps webpack from trying to package them.
    // The ppaPackageList variable is set to non-empty if the build pipeline has been
    // authenticated to install @msrvida/python-program-analysis.
    externals: ['vscode', 'commonjs', ...ppaPackageList, ...existingModulesInOutDir],
    plugins: [
        ...common.getDefaultPlugins('extension'),
        // Copy pdfkit bits after extension builds. webpack can't handle pdfkit.
        new FileManagerPlugin({
            onEnd: [
                {
                    copy: [
                        { source: './node_modules/fontkit/*.trie', destination: './out/client/node_modules' },
                        { source: './node_modules/pdfkit/js/data/*.*', destination: './out/client/node_modules/data' },
                        { source: './node_modules/pdfkit/js/pdfkit.js', destination: './out/client/node_modules/' },
                    ],
                },
            ],
        }),
        // ZMQ requires prebuilds to be in our node_modules directory. So recreate the ZMQ structure.
        // However we don't webpack to manage this, so it was part of the excluded modules. Delete it from there
        // so at runtime we pick up the original structure.
        new removeFilesWebpackPlugin({ after: { include: ['./out/client/node_modules/zeromq.js'] } }),
        new copyWebpackPlugin([{ from: './node_modules/zeromq/**/*.js' }]),
        new copyWebpackPlugin([{ from: './node_modules/zeromq/**/*.node' }]),
        new copyWebpackPlugin([{ from: './node_modules/zeromq/**/*.json' }]),
        new copyWebpackPlugin([{ from: './node_modules/node-gyp-build/**/*' }]),
    ],
    resolve: {
        alias: {
            // Pointing pdfkit to a dummy js file so webpack doesn't fall over.
            // Since pdfkit has been externalized (it gets updated with the valid code by copying the pdfkit files
            // into the right destination).
            pdfkit: path.resolve(__dirname, 'pdfkit.js'),
        },
        extensions: ['.ts', '.js'],
        plugins: [new tsconfig_paths_webpack_plugin.TsconfigPathsPlugin({ configFile: configFileName })],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(constants.ExtensionRootDir, 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]',
    },
};
// tslint:disable-next-line:no-default-export
exports.default = config;
