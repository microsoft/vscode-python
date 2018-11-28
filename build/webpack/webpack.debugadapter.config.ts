// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration, ContextReplacementPlugin } from 'webpack';
import { ExtensionRootDir } from '../constants';
import { getDefaultPlugins } from './common';

// tslint:disable-next-line:no-var-requires no-require-imports
const configFileName = path.join(ExtensionRootDir, 'tsconfig.extension.json');

const config: Configuration = {
    mode: 'production',
    target: 'node',
    entry: {
        'debugger/debugAdapter/main': './src/client/debugger/debugAdapter/main.ts'
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
                // Do not use __dirname in getos when using require.
                test: /getos[\\\/]index.js$/,
                use: [
                    {
                        loader: path.join(__dirname, 'loaders', 'fixGetosRequire.js')
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
            }
        ]
    },
    externals: [
        'vscode',
        'commonjs'
    ],
    plugins: [
        ...getDefaultPlugins('extension'),
        new ContextReplacementPlugin(/getos/, /logic\/.*.js/)
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
