// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Note to editors, if you change this file you have to restart compile-webviews.
// It doesn't reload the config otherwise.

const common = require('./common');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FixDefaultImportPlugin = require('webpack-fix-default-import-plugin');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const constants = require('../constants');
const configFileName = 'tsconfig.datascience-ui.json';

// Any build on the CI is considered production mode.
const isProdBuild = constants.isCI || process.argv.includes('--mode');

function getEntry(isNotebook) {
    if (isNotebook) {
        return {
            nativeEditor: ['babel-polyfill', `./src/datascience-ui/native-editor/index.tsx`],
            interactiveWindow: ['babel-polyfill', `./src/datascience-ui/history-react/index.tsx`]
        };
    }

    return {
        plotViewer: ['babel-polyfill', `./src/datascience-ui/plot/index.tsx`],
        dataExplorer: ['babel-polyfill', `./src/datascience-ui/data-explorer/index.tsx`]
    };
}

function getPlugins(isNotebook) {
    const plugins = [];
    if (isNotebook) {
        plugins.push(
            new MonacoWebpackPlugin({
                languages: [] // force to empty so onigasm will be used
            })
        );
    } else {
        plugins.push(
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('production')
                }
            })
        );
    }

    if (isProdBuild) {
        plugins.push(...common.getDefaultPlugins(isNotebook ? 'notebook' : 'viewers'));
    }

    return plugins;
}

function buildConfiguration(isNotebook) {
    const bundleFolder = isNotebook ? 'notebook' : 'viewers';
    return {
        context: constants.ExtensionRootDir,
        entry: getEntry(isNotebook),
        output: {
            path: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', bundleFolder),
            filename: '[name].js',
            chunkFilename: `[name].bundle.js`
        },
        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        devtool: 'source-map',
        optimization: {
            minimize: true,
            minimizer: [new TerserPlugin({ sourceMap: true })],
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    commons: {
                        name: 'commons',
                        chunks: 'initial',
                        minChunks: isNotebook ? 2 : 1, // We want at least one shared bundle (2 for notebooks, as we want monago split into another).
                        filename: '[name].initial.bundle.js'
                    },
                    nteract: {
                        name: 'nteract',
                        chunks: 'all',
                        minChunks: 2,
                        test(module, _chunks) {
                            // `module.resource` contains the absolute path of the file on disk.
                            // Look for `node_modules/monaco...`.
                            const path = require('path');
                            return module.resource && module.resource.includes(`${path.sep}node_modules${path.sep}@nteract`);
                        }
                    },
                    plotly: {
                        name: 'plotly',
                        chunks: 'all',
                        minChunks: 1,
                        test(module, _chunks) {
                            // `module.resource` contains the absolute path of the file on disk.
                            // Look for `node_modules/monaco...`.
                            const path = require('path');
                            return module.resource && module.resource.includes(`${path.sep}node_modules${path.sep}plotly`);
                        }
                    },
                    monaco: {
                        name: 'monaco',
                        chunks: 'all',
                        minChunks: 1,
                        test(module, _chunks) {
                            // `module.resource` contains the absolute path of the file on disk.
                            // Look for `node_modules/monaco...`.
                            const path = require('path');
                            return module.resource && module.resource.includes(`${path.sep}node_modules${path.sep}monaco`);
                        }
                    }
                }
            },
            chunkIds: 'named'
        },
        node: {
            fs: 'empty'
        },
        plugins: [
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
            new webpack.optimize.LimitChunkCountPlugin({
                maxChunks: 100
            }),
            ...getPlugins(isNotebook),
            new HtmlWebpackPlugin({
                template: `src/datascience-ui/${isNotebook ? 'native-editor' : 'plot'}/index.html`,
                indexUrl: `${constants.ExtensionRootDir}/out/1`,
                filename: 'index.html'
            })
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

exports.notebooks = buildConfiguration(true);
exports.viewers = buildConfiguration(false);
