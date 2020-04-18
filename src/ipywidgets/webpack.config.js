// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Copied from https://github.com/jupyter-widgets/ipywidgets/blob/master/packages/html-manager/webpack.config.js

const postcss = require('postcss');
const webpack_bundle_analyzer = require('webpack-bundle-analyzer');
const common = require('../../build/webpack/common');
const path = require('path');
const constants = require('../../build/constants');
const outDir = path.join(__dirname, '..', '..', 'out', 'ipywidgets');
const version = require(path.join(
    __dirname,
    '..',
    '..',
    'node_modules',
    '@jupyter-widgets',
    'jupyterlab-manager',
    'package.json'
)).version;
// Any build on the CI is considered production mode.
const isProdBuild = constants.isCI || process.argv.includes('--mode');
const publicPath = 'https://unpkg.com/@jupyter-widgets/jupyterlab-manager@' + version + '/dist/';
const rules = [
    { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    // jquery-ui loads some images
    { test: /\.(jpg|png|gif)$/, use: 'file-loader' },
    // required to load font-awesome
    {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        use: {
            loader: 'url-loader',
            options: {
                limit: 10000,
                mimetype: 'application/font-woff'
            }
        }
    },
    {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        use: {
            loader: 'url-loader',
            options: {
                limit: 10000,
                mimetype: 'application/font-woff'
            }
        }
    },
    {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        use: {
            loader: 'url-loader',
            options: {
                limit: 10000,
                mimetype: 'application/octet-stream'
            }
        }
    },
    { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, use: 'file-loader' },
    {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        use: {
            loader: 'url-loader',
            options: {
                limit: 10000,
                mimetype: 'image/svg+xml'
            }
        }
    }
];

module.exports = [
    {
        mode: isProdBuild ? 'production' : 'development',
        devtool: isProdBuild ? 'source-map' : 'inline-source-map',
        entry: path.join(outDir, 'index.js'),
        output: {
            filename: 'ipywidgets.js',
            path: path.resolve(outDir, 'dist'),
            publicPath: 'built/',
            library: 'vscIPyWidgets',
            libraryTarget: 'window'
        },
        plugins: [...common.getDefaultPlugins('ipywidgets')],
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        'style-loader',
                        'css-loader',
                        {
                            loader: 'postcss-loader',
                            options: {
                                plugins: [
                                    postcss.plugin('delete-tilde', function () {
                                        return function (css) {
                                            css.walkAtRules('import', function (rule) {
                                                rule.params = rule.params.replace('~', '');
                                            });
                                        };
                                    }),
                                    postcss.plugin('prepend', function () {
                                        return function (css) {
                                            css.prepend("@import '@jupyter-widgets/controls/css/labvariables.css';");
                                        };
                                    }),
                                    require('postcss-import')(),
                                    require('postcss-cssnext')()
                                ]
                            }
                        }
                    ]
                },
                // jquery-ui loads some images
                { test: /\.(jpg|png|gif)$/, use: 'file-loader' },
                // required to load font-awesome
                {
                    test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
                    use: {
                        loader: 'url-loader',
                        options: {
                            limit: 10000,
                            mimetype: 'application/font-woff'
                        }
                    }
                },
                {
                    test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
                    use: {
                        loader: 'url-loader',
                        options: {
                            limit: 10000,
                            mimetype: 'application/font-woff'
                        }
                    }
                },
                {
                    test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
                    use: {
                        loader: 'url-loader',
                        options: {
                            limit: 10000,
                            mimetype: 'application/octet-stream'
                        }
                    }
                },
                { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, use: 'file-loader' },
                {
                    test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
                    use: {
                        loader: 'url-loader',
                        options: {
                            limit: 10000,
                            mimetype: 'image/svg+xml'
                        }
                    }
                }
            ]
        }
    }
];
