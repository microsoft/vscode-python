// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// Copied from https://github.com/jupyter-widgets/ipywidgets/blob/master/packages/html-manager/webpack.config.js

const postcss = require('postcss');
var path = require('path');

module.exports = {
    mode: 'production',
    entry: './out/index.js',
    output: {
        filename: 'ipywidgets.js',
        path: path.resolve(__dirname, 'dist', 'ipywidgets'),
        publicPath: 'built/',
		library: "vscIPyWidgets",
		libraryTarget: "window"
    },
    module: {
        rules: [
            { test: /\.css$/, use: [
                'style-loader',
                'css-loader',
                {
                    loader: 'postcss-loader',
                    options: {
                        plugins: [
                            postcss.plugin('delete-tilde', function() {
                                return function (css) {
                                    css.walkAtRules('import', function(rule) {
                                        rule.params = rule.params.replace('~', '');
                                    });
                                };
                            }),
                            postcss.plugin('prepend', function() {
                                return function(css) {
                                    css.prepend("@import '@jupyter-widgets/controls/css/labvariables.css';")
                                }
                            }),
                            require('postcss-import')(),
                            require('postcss-cssnext')()
                        ]
                    }
                }
            ]},
            // jquery-ui loads some images
            { test: /\.(jpg|png|gif)$/, use: 'file-loader' },
            // required to load font-awesome
            { test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/, use: {
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    mimetype: 'application/font-woff'
                }
            }},
            { test: /\.woff(\?v=\d+\.\d+\.\d+)?$/, use: {
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    mimetype: 'application/font-woff'
                }
            }},
            { test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, use: {
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    mimetype: 'application/octet-stream'
                }
            }},
            { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, use: 'file-loader' },
            { test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, use: {
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    mimetype: 'image/svg+xml'
                }
            }}
        ]
    },
};
