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

module.exports = [
    {
        context: constants.ExtensionRootDir,
        entry: ['babel-polyfill', './src/datascience-ui/history-react/index.tsx'],
        output: {
            path: path.join(constants.ExtensionRootDir, 'out'),
            filename: 'datascience-ui/history-react/index_bundle.js',
            publicPath: './'
        },
        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        // Use 'eval' for release and `eval-source-map` for development.
        // We need to use one where source is embedded, due to webviews (they restrict resources to specific schemes,
        //  this seems to prevent chrome from downloading the source maps)
        devtool: 'eval-source-map',
        optimization: {
            minimizer: [new TerserPlugin()]
        },
        node: {
            fs: 'empty'
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: 'src/datascience-ui/history-react/index.html',
                imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/history-react`,
                indexUrl: `${constants.ExtensionRootDir}/out/1`,
                filename: './datascience-ui/history-react/index.html'
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
                { test: /\.(png|woff|woff2|eot|ttf)$/, loader: 'url-loader?limit=100000' },
                {
                    test: /\.less$/,
                    use: ['style-loader', 'css-loader', 'less-loader']
                }
            ]
        }
    },
    {
        context: constants.ExtensionRootDir,
        entry: ['babel-polyfill', './src/datascience-ui/native-editor/index.tsx'],
        output: {
            path: path.join(constants.ExtensionRootDir, 'out'),
            filename: 'datascience-ui/native-editor/index_bundle.js',
            publicPath: './'
        },

        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        // Use 'eval' for release and `eval-source-map` for development.
        // We need to use one where source is embedded, due to webviews (they restrict resources to specific schemes,
        //  this seems to prevent chrome from downloading the source maps)
        devtool: 'eval-source-map',
        optimization: {
            minimizer: [new TerserPlugin()]
        },
        node: {
            fs: 'empty'
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: 'src/datascience-ui/native-editor/index.html',
                imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/native-editor`,
                indexUrl: `${constants.ExtensionRootDir}/out/1`,
                filename: './datascience-ui/native-editor/index.html'
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
                { test: /\.(png|woff|woff2|eot|ttf)$/, loader: 'url-loader?limit=100000' },
                {
                    test: /\.less$/,
                    use: ['style-loader', 'css-loader', 'less-loader']
                }
            ]
        }
    },
    {
        context: constants.ExtensionRootDir,
        entry: ['babel-polyfill', './src/datascience-ui/data-explorer/index.tsx'],
        output: {
            path: path.join(constants.ExtensionRootDir, 'out'),
            filename: 'datascience-ui/data-explorer/index_bundle.js',
            publicPath: './'
        },

        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        // Use 'eval' for release and `eval-source-map` for development.
        // We need to use one where source is embedded, due to webviews (they restrict resources to specific schemes,
        //  this seems to prevent chrome from downloading the source maps)
        devtool: 'eval-source-map',
        optimization: {
            minimizer: [new TerserPlugin()]
        },
        node: {
            fs: 'empty'
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: 'src/datascience-ui/data-explorer/index.html',
                imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/data-explorer`,
                indexUrl: `${constants.ExtensionRootDir}/out/1`,
                filename: './datascience-ui/data-explorer/index.html'
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
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('production')
                }
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
                { test: /\.(png|woff|woff2|eot|gif|ttf)$/, loader: 'url-loader?limit=100000' },
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
                }
            ]
        }
    },
    {
        context: constants.ExtensionRootDir,
        entry: ['babel-polyfill', './src/datascience-ui/plot/index.tsx'],
        output: {
            path: path.join(constants.ExtensionRootDir, 'out'),
            filename: 'datascience-ui/plot/index_bundle.js',
            publicPath: './'
        },

        mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
        // Use 'eval' for release and `eval-source-map` for development.
        // We need to use one where source is embedded, due to webviews (they restrict resources to specific schemes,
        //  this seems to prevent chrome from downloading the source maps)
        devtool: 'eval-source-map',
        optimization: {
            minimizer: [new TerserPlugin()]
        },
        node: {
            fs: 'empty'
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: 'src/datascience-ui/plot/index.html',
                imageBaseUrl: `${constants.ExtensionRootDir.replace(/\\/g, '/')}/out/datascience-ui/plot`,
                indexUrl: `${constants.ExtensionRootDir}/out/1`,
                filename: './datascience-ui/plot/index.html'
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
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('production')
                }
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
                { test: /\.(png|woff|woff2|eot|gif|ttf)$/, loader: 'url-loader?limit=100000' },
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
                }
            ]
        }
    }
];
