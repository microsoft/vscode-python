// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const merge = require('webpack-merge');
const datascience = require('./webpack.datascience-ui.config.js');
const extensionDependencies = require('./build/webpack/webpack.extension.dependencies.config.js').default;

module.exports = [
    // history-react
    merge(datascience[0], {
        devtool: 'eval'
    }),
    // data-explorer
    merge(datascience[1], {
        devtool: 'eval'
    }),
    // plot
    merge(datascience[2], {
        devtool: 'eval'
    }),
    merge(extensionDependencies, {
        mode: 'production',
        devtool: 'source-map',
    })
];
