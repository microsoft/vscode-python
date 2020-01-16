// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Note to editors, if you change this file you have to restart compile-webviews.
// It doesn't reload the config otherwise.

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FixDefaultImportPlugin = require('webpack-fix-default-import-plugin');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const constants = require('../constants');
const configFileName = 'tsconfig.datascience-ui.json';

function getPlugins(folderName) {
    if (folderName === 'history-react' || folderName === 'native-editor') {
        return [
            new MonacoWebpackPlugin({
                languages: [] // force to empty so onigasm will be used
            })
        ];
    }

    return [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify('production')
            }
        })
    ];
}

function buildConfiguration(folderName) {
    return {
        context: constants.ExtensionRootDir,
        entry: ['babel-polyfill', `./src/datascience-ui/${folderName}/index.tsx`],
        output: {
            path: path.join(constants.ExtensionRootDir, 'out'),
            filename: `datascience-ui/${folderName}/index_bundle.js`,
            publicPath: './'
        },
        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        // Use 'eval' for release and `eval-source-map` for development.
        // We need to use one where source is embedded, due to webviews (they restrict resources to specific schemes,
        //  this seems to prevent chrome from downloading the source maps)
        devtool: 'eval-source-map',
        optimization: {
            minimizer: [new TerserPlugin({ sourceMap: true })]
        },
        node: {
            fs: 'empty'
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: `src/datascience-ui/${folderName}/index.html`,
                imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/${folderName}`,
                indexUrl: `${constants.ExtensionRootDir}/out/1`,
                filename: `./datascience-ui/${folderName}/index.html`
            }),
            new FixDefaultImportPlugin(),
            new CopyWebpackPlugin(
                [
                    { from: './**/*.png', to: '.' },
                    { from: './**/*.svg', to: '.' },
                    { from: './**/*.css', to: '.' },
                    { from: './**/*theme*.json', to: '.' }
                ],
                { context: 'src' }
            ),
            new MonacoWebpackPlugin({
                languages: [] // force to empty so onigasm will be used
            }),
            ...getPlugins(folderName)
        ],
        resolve: {
            // Add '.ts' and '.tsx' as resolvable extensions.
            extensions: ['.ts', '.tsx', '.js', '.json', '.svg']
        },

        module: {
            rules: [
                // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
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

exports.interactiveWindowConfig = buildConfiguration('history-react');
exports.nativeEditorConfig = buildConfiguration('native-editor');
exports.dataExplorerConfig = buildConfiguration('data-explorer');
exports.plotViewerConfig = buildConfiguration('plot');
