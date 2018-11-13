// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import * as webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

const configFileName = 'tsconfig.extension.json';

const config: webpack.Configuration = {
    mode: 'production',
    target: 'node',
    entry: {
        extension: './src/client/extension.ts',
        debugAdapter: './src/client/debugger/debugAdapter/main.ts',
        unicode_category_Lu: './node_modules/unicode/category/Lu.js',
        unicode_category_Ll: './node_modules/unicode/category/Ll.js',
        unicode_category_Lt: './node_modules/unicode/category/Lt.js',
        unicode_category_Lo: './node_modules/unicode/category/Lo.js',
        unicode_category_Nl: './node_modules/unicode/category/Nl.js',
        unicode_category_Mn: './node_modules/unicode/category/Mn.js',
        unicode_category_Mcc: './node_modules/unicode/category/Mc.js',
        unicode_category_Nd: './node_modules/unicode/category/Nd.js',
        unicode_category_Pc: './node_modules/unicode/category/Pc.js'
    },
    // devtool: 'source-map',
    devtool: false,
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
                        loader: 'ts-loader'
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
            //         loader: 'awesome-typescript-loader',
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
            analyzerMode: 'static'
        })
    ],
    externals: [
        'vscode',
        'commonjs',

        'unicode/category/Lu',
        'unicode/category/Ll',
        'unicode/category/Lt',
        'unicode/category/Lo',
        'unicode/category/Lo',
        'unicode/category/Lm',
        'unicode/category/Nl',
        'unicode/category/Mn',
        'unicode/category/Mc',
        'unicode/category/Nd',
        'unicode/category/Pc',

        'out/unicode/category/Lu',
        'out/unicode/category/Ll',
        'out/unicode/category/Lt',
        'out/unicode/category/Lo',
        'out/unicode/category/Lo',
        'out/unicode/category/Lm',
        'out/unicode/category/Nl',
        'out/unicode/category/Mn',
        'out/unicode/category/Mc',
        'out/unicode/category/Nd',
        'out/unicode/category/Pc',

        './out/unicode/category/Lu',
        './out/unicode/category/Ll',
        './out/unicode/category/Lt',
        './out/unicode/category/Lo',
        './out/unicode/category/Lo',
        './out/unicode/category/Lm',
        './out/unicode/category/Nl',
        './out/unicode/category/Mn',
        './out/unicode/category/Mc',
        './out/unicode/category/Nd',
        './out/unicode/category/Pc',

        './out/unicode/category/Lu.js',
        './out/unicode/category/Ll.js',
        './out/unicode/category/Lt.js',
        './out/unicode/category/Lo.js',
        './out/unicode/category/Lo.js',
        './out/unicode/category/Lm.js',
        './out/unicode/category/Nl.js',
        './out/unicode/category/Mn.js',
        './out/unicode/category/Mc.js',
        './out/unicode/category/Nd.js',
        './out/unicode/category/Pc.js'
    ],
    resolve: {
        extensions: ['.ts', '.js'],
        plugins: [new TsconfigPathsPlugin({ configFile: configFileName })],
        alias: {
            'unicode/category/Lu$': 'out/client/unicode_category_Lu.js',
            'unicode/category/Lu': 'out/client/unicode_category_Lu.js'
            // 'unicode/category/Lu$': path.join(__dirname, 'out', 'client', 'unicode_category_Lu.js'),
            // 'unicode/category/Lu': path.join(__dirname, 'out', 'client', 'unicode_category_Lu.js'),
        }
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, '..', '..', 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    }
};

// tslint:disable-next-line:no-default-export
export default config;
