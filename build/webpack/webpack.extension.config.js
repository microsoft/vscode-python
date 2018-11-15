// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const tsconfig_paths_webpack_plugin_1 = require("tsconfig-paths-webpack-plugin");
const webpack_bundle_analyzer_1 = require("webpack-bundle-analyzer");
const nodeExternals = require("webpack-node-externals");
// tslint:disable-next-line:no-var-requires no-require-imports
const WrapperPlugin = require('wrapper-webpack-plugin');
const configFileName = path.join(__dirname, '..', '..', 'tsconfig.extension.json');
const config = {
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
        new webpack_bundle_analyzer_1.BundleAnalyzerPlugin({
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
            new tsconfig_paths_webpack_plugin_1.TsconfigPathsPlugin({ configFile: configFileName })
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
exports.default = config;
