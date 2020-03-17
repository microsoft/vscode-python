// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Copied from https://github.com/jupyter-widgets/ipywidgets/blob/master/packages/html-manager/webpack.config.js

const postcss = require('postcss');
const path = require('path');
const version = require(path.join(__dirname, 'node_modules', '@jupyter-widgets', 'html-manager', 'package.json')).version;

const publicPath = 'https://unpkg.com/@jupyter-widgets/html-manager@' + version + '/dist/';
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
        mode: 'production',
        entry: './out/index.js',
        output: {
            filename: 'ipywidgets.js',
            path: path.resolve(__dirname, 'dist', 'ipywidgets'),
            publicPath: 'built/',
            library: 'vscIPyWidgets',
            libraryTarget: 'window'
        },
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
                                    postcss.plugin('delete-tilde', function() {
                                        return function(css) {
                                            css.walkAtRules('import', function(rule) {
                                                rule.params = rule.params.replace('~', '');
                                            });
                                        };
                                    }),
                                    postcss.plugin('prepend', function() {
                                        return function(css) {
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
    },
    {
        // script that renders widgets using the amd embedding and can render third-party custom widgets
        entry: './lib/embed-amd-render.js',
        output: {
            filename: 'embed-amd-render.js',
            path: path.resolve(__dirname, 'dist', 'lib', 'amd'),
            publicPath: publicPath
        },
        module: { rules: rules },
        mode: 'production'
    },

    {
        // embed library that depends on requirejs, and can load third-party widgets dynamically
        entry: './lib/libembed-amd.js',
        output: {
            library: '@jupyter-widgets/html-manager/dist/libembed-amd',
            filename: 'libembed-amd.js',
            path: path.resolve(__dirname, 'dist', 'lib', 'amd'),
            publicPath: publicPath,
            libraryTarget: 'amd'
        },
        module: { rules: rules },
        mode: 'production'
    }
];
