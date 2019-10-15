// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration } from 'webpack';
import { ExtensionRootDir } from '../constants';
import { getDefaultPlugins, getListOfExistingModulesInOutDir } from './common';

// tslint:disable-next-line:no-var-requires no-require-imports
const configFileName = path.join(ExtensionRootDir, 'tsconfig.extension.json');

// Some modules will be pre-genearted and stored in out/.. dir and they'll be referenced via NormalModuleReplacementPlugin
// We need to ensure they do not get bundled into the output (as they are large).
const existingModulesInOutDir = getListOfExistingModulesInOutDir();

// tslint:disable-next-line:no-var-requires no-require-imports
const FileManagerPlugin = require('filemanager-webpack-plugin');

const config: Configuration = {
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
            {enforce: 'post', test: /unicode-properties[\/\\]index.js$/, loader: 'transform-loader?brfs'},
            {enforce: 'post', test: /fontkit[\/\\]index.js$/, loader: 'transform-loader?brfs'},
            {enforce: 'post', test: /pdfkit[\\\/]js[\\\/].*js$/, loader: 'transform-loader?brfs'},
            {enforce: 'post', test: /linebreak[\/\\]src[\/\\]linebreaker.js/, loader: 'transform-loader?brfs'}
        ]
    },
    externals: [
        'vscode',
        'commonjs',
        ...existingModulesInOutDir
    ],
    plugins: [
        ...getDefaultPlugins('extension'),
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
        extensions: ['.ts', '.js'],
        plugins: [
            new TsconfigPathsPlugin({ configFile: configFileName })
        ]
    },
    output: {
        filename: '[name].js',
        path: path.resolve(ExtensionRootDir, 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};

// tslint:disable-next-line:no-default-export
export default config;
