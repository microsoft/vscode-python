// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const merge = require('webpack-merge');
const datascience = require('./webpack.datascience-ui.config.js');
const extension = require('./build/webpack/webpack.extension.config.js').default;
const extensionDependencies = require('./build/webpack/webpack.extension.dependencies.config.js').default;

module.exports = [
    merge(datascience, {
        devtool: 'eval'
    }),
    merge(extensionDependencies, {
        mode: 'production',
        devtool: 'source-map',
    }),
    merge(extension, {
        mode: 'production',
        devtool: 'source-map',
    })
];
