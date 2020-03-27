// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable-next-line: no-require-imports
const copyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const constants = require('../constants');
const common = require('./common');
const entryItems = {};
common.nodeModulesToExternalize.forEach((moduleName) => {
    entryItems[`node_modules/${moduleName}`] = `./node_modules/${moduleName}`;
});
const config = {
    mode: 'production',
    target: 'node',
    context: constants.ExtensionRootDir,
    entry: entryItems,
    devtool: 'source-map',
    node: {
        __dirname: false
    },
    module: {
        rules: [
            {
                // JupyterServices imports node-fetch.
                test: /@jupyterlab[\\\/]services[\\\/].*js$/,
                use: [
                    {
                        loader: path.join(__dirname, 'loaders', 'fixNodeFetch.js')
                    }
                ]
            },
            { enforce: 'post', test: /unicode-properties[\/\\]index.js$/, loader: 'transform-loader?brfs' },
            { enforce: 'post', test: /fontkit[\/\\]index.js$/, loader: 'transform-loader?brfs' },
            { enforce: 'post', test: /linebreak[\/\\]src[\/\\]linebreaker.js/, loader: 'transform-loader?brfs' }
        ]
    },
    externals: ['vscode', 'commonjs'],
    plugins: [
        ...common.getDefaultPlugins('dependencies'),
        // vsls requires our package.json to be next to node_modules. It's how they
        // 'find' the calling extension.
        new copyWebpackPlugin([{ from: './package.json', to: '.' }]),
        // onigasm requires our onigasm.wasm to be in node_modules
        new copyWebpackPlugin([
            { from: './node_modules/onigasm/lib/onigasm.wasm', to: './node_modules/onigasm/lib/onigasm.wasm' }
        ])
    ],
    resolve: {
        alias: {
            // Pointing pdfkit to a dummy js file so webpack doesn't fall over.
            // Since pdfkit has been externalized (it gets updated with the valid code by copying the pdfkit files
            // into the right destination).
            pdfkit: path.resolve(__dirname, 'pdfkit.js')
        },
        extensions: ['.js']
    },
    output: {
        filename: '[name].js',
        path: path.resolve(constants.ExtensionRootDir, 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};
// tslint:disable-next-line:no-default-export
exports.default = config;
