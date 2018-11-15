// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import * as webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import * as nodeExternals from 'webpack-node-externals';
// tslint:disable-next-line:no-var-requires no-require-imports
const WrapperPlugin = require('wrapper-webpack-plugin');

const configFileName = path.join(__dirname, '..', '..', 'tsconfig.extension.json');

const config: webpack.Configuration = {
    mode: 'production',
    target: 'node',
    entry: {
        extension: './src/client/extension.ts',
        'debugger/debugAdapter/main': './src/client/debugger/debugAdapter/main.ts'
    },
    devtool: 'source-map',
    node: {
        __dirname: false
    },
    module: {
        rules: [
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
        'commonjs',
        nodeExternals()
    ],
    plugins: [
        new BundleAnalyzerPlugin({
            analyzerMode: 'static'
        }),
        new WrapperPlugin({
            test: /\.js$/,
            header: 'require(\'source-map-support\').install();'
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
        path: path.resolve(__dirname, '..', '..', 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};

// tslint:disable-next-line:no-default-export
export default config;
