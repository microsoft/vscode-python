// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const common = require('./common');
const modulesToExternalize = require('./common').uiModulesToExternalize;
const webpack = require('webpack');
const FixDefaultImportPlugin = require('webpack-fix-default-import-plugin');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const constants = require('../constants');
const configFileName = 'tsconfig.datascience-ui.json';
const isProdBuild = process.argv.includes('--mode');

function buildConfiguration(moduleName, outputFileNameWithoutJsExtension) {
    const productionOnlyPlugins = isProdBuild
        ? common.getDefaultPlugins(moduleName).concat([
              new webpack.DefinePlugin({
                  'process.env': {
                      NODE_ENV: JSON.stringify('production')
                  }
              })
          ])
        : [];

    return {
        context: constants.ExtensionRootDir,
        entry: [moduleName],
        output: {
            path: path.join(constants.ExtensionRootDir, 'out'),
            filename: `datascience-ui/notebook/${outputFileNameWithoutJsExtension}.js`,
            library: outputFileNameWithoutJsExtension,
            libraryTarget: 'amd'
        },
        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        devtool: 'none',
        optimization: {
            // minimize: false
            minimize: true,
            minimizer: [new TerserPlugin({ sourceMap: false })]
        },
        node: {
            fs: 'empty'
        },
        plugins: [
            ...productionOnlyPlugins,
            new FixDefaultImportPlugin(),
            new CopyWebpackPlugin(
                [
                    { from: './src/**/*.png', to: '.' },
                    { from: './src/**/*.svg', to: '.' },
                    { from: './src/**/*.css', to: '.' },
                    { from: './src/**/*theme*.json', to: '.' }
                ],
                { context: 'src' }
            )
        ],
        resolve: {
            // Add '.ts' and '.tsx' as resolvable extensions.
            extensions: ['.ts', '.tsx', '.js', '.json', '.svg']
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: {
                        loader: 'awesome-typescript-loader',
                        options: {
                            configFileName,
                            reportFiles: ['src/datascience-ui/**/*.{ts,tsx}']
                        }
                    }
                },
                {
                    test: /\.svg$/,
                    use: ['svg-inline-loader']
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.js$/,
                    include: /node_modules.*remark.*default.*js/,
                    use: [
                        {
                            loader: path.resolve('./build/webpack/loaders/remarkLoader.js'),
                            options: {}
                        }
                    ]
                },
                {
                    test: /\.json$/,
                    type: 'javascript/auto',
                    include: /node_modules.*remark.*/,
                    use: [
                        {
                            loader: path.resolve('./build/webpack/loaders/jsonloader.js'),
                            options: {}
                        }
                    ]
                },
                { test: /\.(png|woff|woff2|eot|gif|ttf)$/, loader: 'url-loader?limit=100000' },
                {
                    test: /\.less$/,
                    use: ['style-loader', 'css-loader', 'less-loader']
                }
            ]
        }
    };
}

module.exports = modulesToExternalize.map(moduleName => buildConfiguration(require.resolve(moduleName), moduleName));
