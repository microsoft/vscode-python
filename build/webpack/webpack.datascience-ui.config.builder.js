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

function getPlugins(folderName) {
    if (folderName === 'history-react' || folderName === 'native-editor') {
        return [
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('production')
                }
            }),
            new MonacoWebpackPlugin({
                languages: [] // force to empty so onigasm will be used
            }),
            new HtmlWebpackPlugin({
                template: `src/datascience-ui/notebook.html`,
                imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/notebook`,
                indexUrl: `${constants.ExtensionRootDir}/out/1`,
                filename: `./datascience-ui/notebook/native_index.html`,
                isNativeEditor: true
            }),
            new HtmlWebpackPlugin({
                template: `src/datascience-ui/notebook.html`,
                imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/notebook`,
                indexUrl: `${constants.ExtensionRootDir}/out/1`,
                filename: `./datascience-ui/notebook/interactive_index.html`,
                isNativeEditor: false
            })
        ];
    }

    return [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify('production')
            }
        }),
        new HtmlWebpackPlugin({
            template: `src/datascience-ui/viewer.html`,
            imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/viewer`,
            indexUrl: `${constants.ExtensionRootDir}/out/1`,
            filename: `./datascience-ui/viewer/plotViewer_index.html`,
            isPlotViewer: true
        }),
        new HtmlWebpackPlugin({
            template: `src/datascience-ui/viewer.html`,
            imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/viewer`,
            indexUrl: `${constants.ExtensionRootDir}/out/1`,
            filename: `./datascience-ui/viewer/dataExplorer_index.html`,
            isPlotViewer: false
        })
    ];
}

/**
 * Gets files that need to be copied into specific locations as part of build.
 *
 * @param {*} folderName
 * @returns
 */
function getItemsToCopy(folderName) {
    if (folderName === 'history-react' || folderName === 'native-editor') {
        return [
            {
                from: path.join(constants.ExtensionRootDir, 'build', 'webpack', 'nativeEditor.js'),
                to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', 'notebook', 'nativeEditor.js')
            },
            {
                from: path.join(constants.ExtensionRootDir, 'build', 'webpack', 'interactiveWindow.js'),
                to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', 'notebook', 'interactiveWindow.js')
            },
            {
                from: path.join(constants.ExtensionRootDir, 'node_modules', 'requirejs', 'require.js'),
                to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', 'notebook', 'require.js')
            }
        ];
    }
    return [
        {
            from: path.join(constants.ExtensionRootDir, 'build', 'webpack', 'plotViewer.js'),
            to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', 'viewer', 'plotViewer.js')
        },
        {
            from: path.join(constants.ExtensionRootDir, 'build', 'webpack', 'dataExplorer.js'),
            to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', 'viewer', 'dataExplorer.js')
        },
        {
            from: path.join(constants.ExtensionRootDir, 'node_modules', 'requirejs', 'require.js'),
            to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', 'viewer', 'require.js')
        }
    ];
}

function getOutput(folderName) {
    if (folderName === 'history-react' || folderName === 'native-editor') {
        return {
            path: path.join(constants.ExtensionRootDir, 'out'),
            filename: `datascience-ui/notebook/index_bundle.js`,
            publicPath: './'
        };
    } else {
        return {
            path: path.join(constants.ExtensionRootDir, 'out'),
            filename: `datascience-ui/viewer/index_bundle.js`,
            publicPath: './'
        };
    }
}

function getEntry(folderName) {
    if (folderName === 'history-react' || folderName === 'native-editor') {
        return ['babel-polyfill', `./src/datascience-ui/notebook.tsx`];
    } else {
        return ['babel-polyfill', `./src/datascience-ui/viewer.tsx`];
    }
}

function buildConfiguration(folderName) {
    return {
        context: constants.ExtensionRootDir,
        entry: getEntry(folderName),
        output: getOutput(folderName),
        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        // Use 'eval' for release and `eval-source-map` for development.
        // We need to use one where source is embedded, due to webviews (they restrict resources to specific schemes,
        //  this seems to prevent chrome from downloading the source maps)
        // devtool: 'none',
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
            ...common.getDefaultPlugins(folderName),
            new FixDefaultImportPlugin(),
            new CopyWebpackPlugin(
                [
                    { from: './**/*.png', to: '.' },
                    { from: './**/*.svg', to: '.' },
                    { from: './**/*.css', to: '.' },
                    { from: './**/*theme*.json', to: '.' },
                    ...getItemsToCopy(folderName)
                ],
                { context: 'src' }
            ),
            ...getPlugins(folderName)
        ],
        resolve: {
            // Add '.ts' and '.tsx' as resolvable extensions.
            extensions: ['.ts', '.tsx', '.js', '.json', '.svg']
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: [
                        {
                            loader: path.join(__dirname, 'loaders', 'externalizeUIDependencies.js')
                        }
                    ]
                },
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

exports.nativeEditorConfig = buildConfiguration('native-editor', false);
exports.plotViewerConfig = buildConfiguration('plot', false);
