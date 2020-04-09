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
    if (isProdBuild) {
        plugins.push(...common.getDefaultPlugins(isNotebook ? 'notebook' : 'viewers'));
    }

    if (isNotebook) {
        plugins.push(
            new MonacoWebpackPlugin({
                languages: [] // force to empty so onigasm will be used
            }),
            new HtmlWebpackPlugin({
                template: path.join(__dirname, '/nativeOrInteractivePicker.html'),
                chunks: [],
                filename: 'index.html'
            }),
            new HtmlWebpackPlugin({
                template: 'src/datascience-ui/native-editor/index.html',
                chunks: ['monaco', 'commons', 'nativeEditor'],
                filename: 'index.nativeEditor.html'
            }),
            new HtmlWebpackPlugin({
                template: 'src/datascience-ui/history-react/index.html',
                chunks: ['monaco', 'commons', 'interactiveWindow'],
                filename: 'index.interactiveWindow.html'
            })
        );
    } else {
        const definePlugin = new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify('production')
            }
        });

        plugins.push(
            ...(isProdBuild ? [definePlugin] : []),
            ...[
                new HtmlWebpackPlugin({
                    template: 'src/datascience-ui/plot/index.html',
                    indexUrl: `${constants.ExtensionRootDir}/out/1`,
                    chunks: ['commons', 'plotViewer'],
                    filename: 'index.plotViewer.html'
                }),
                new HtmlWebpackPlugin({
                    template: 'src/datascience-ui/data-explorer/index.html',
                    indexUrl: `${constants.ExtensionRootDir}/out/1`,
                    chunks: ['commons', 'dataExplorer'],
                    filename: 'index.dataExplorer.html'
                })
            ]
        );
    }

    return plugins;
}

function buildConfiguration(isNotebook) {
    // Folder inside `datascience-ui` that will be created and where the files will be dumped.
    const bundleFolder = isNotebook ? 'notebook' : 'viewers';
    const filesToCopy = [];
    if (isNotebook) {
        // Include files only for notebooks.
        filesToCopy.push(
            ...[
                {
                    from: path.join(constants.ExtensionRootDir, 'out/ipywidgets/dist/ipywidgets.js'),
                    to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', bundleFolder)
                },
                {
                    from: path.join(constants.ExtensionRootDir, 'node_modules/font-awesome/**/*'),
                    to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', 'common', 'node_modules')
                }
            ]
        );
    }
    return {
        context: constants.ExtensionRootDir,
        entry: getEntry(isNotebook),
        output: {
            path: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', bundleFolder),
            filename: '[name].js',
            chunkFilename: `[name].bundle.js`
        },
        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        devtool: isProdBuild ? 'source-map' : 'inline-source-map',
        optimization: {
            minimize: isProdBuild,
            minimizer: isProdBuild ? [new TerserPlugin({ sourceMap: true })] : [],
            moduleIds: 'hashed', // (doesn't re-generate bundles unnecessarily) https://webpack.js.org/configuration/optimization/#optimizationmoduleids.
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    // These are bundles that will be created and loaded when page first loads.
                    // These must be added to the page along with the main entry point.
                    // Smaller they are, the faster the load in SSH.
                    // Interactive and native editors will share common code in commons.
                    commons: {
                        name: 'commons',
                        chunks: 'initial',
                        minChunks: isNotebook ? 2 : 1, // We want at least one shared bundle (2 for notebooks, as we want monago split into another).
                        filename: '[name].initial.bundle.js'
                    },
                    // Even though nteract has been split up, some of them are large as nteract alone is large.
                    // This will ensure nteract (just some of the nteract) goes into a separate bundle.
                    // Webpack will bundle others separately when loading them asynchronously using `await import(...)`
                    nteract: {
                        name: 'nteract',
                        chunks: 'all',
                        minChunks: 2,
                        test(module, _chunks) {
                            // `module.resource` contains the absolute path of the file on disk.
                            // Look for `node_modules/monaco...`.
                            const path = require('path');
                            return (
                                module.resource &&
                                module.resource.includes(`${path.sep}node_modules${path.sep}@nteract`)
                            );
                        }
                    },
                    // Bundling `plotly` with nteract isn't the best option, as this plotly alone is 6mb.
                    // This will ensure it is in a seprate bundle, hence small files for SSH scenarios.
                    plotly: {
                        name: 'plotly',
                        chunks: 'all',
                        minChunks: 1,
                        test(module, _chunks) {
                            // `module.resource` contains the absolute path of the file on disk.
                            // Look for `node_modules/monaco...`.
                            const path = require('path');
                            return (
                                module.resource && module.resource.includes(`${path.sep}node_modules${path.sep}plotly`)
                            );
                        }
                    },
                    // Monaco is a monster. For SSH again, we pull this into a seprate bundle.
                    // This is only a solution for SSH.
                    // Ideal solution would be to dynamically load monaoc `await import`, that way it will benefit UX and SSH.
                    // This solution doesn't improve UX, as we still need to wait for monaco to load.
                    monaco: {
                        name: 'monaco',
                        chunks: 'all',
                        minChunks: 1,
                        test(module, _chunks) {
                            // `module.resource` contains the absolute path of the file on disk.
                            // Look for `node_modules/monaco...`.
                            const path = require('path');
                            return (
                                module.resource && module.resource.includes(`${path.sep}node_modules${path.sep}monaco`)
                            );
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
                    { from: './**/*theme*.json', to: '.' },
                    {
                        from: path.join(constants.ExtensionRootDir, 'node_modules/requirejs/require.js'),
                        to: path.join(constants.ExtensionRootDir, 'out', 'datascience-ui', bundleFolder)
                    },
                    ...filesToCopy
                ],
                { context: 'src' }
            ),
            new webpack.optimize.LimitChunkCountPlugin({
                maxChunks: 100
            }),
            ...getPlugins(isNotebook)
        ],
        externals: ['log4js'],
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
                {
                    test: /\.(png|woff|woff2|eot|gif|ttf)$/,
                    use: [
                        {
                            loader: 'url-loader?limit=100000',
                            options: { esModule: false }
                        }
                    ]
                },
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
