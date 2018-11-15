// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const merge = require('webpack-merge');
const datascience = require('./webpack.datascience-ui.config.js');
const extension = require('./build/webpack/webpack.extension.config.js').default;

module.exports = [
    merge(datascience, {
        devtool: 'eval'
    }),
    merge(extension, {
        mode: 'production',
        devtool: 'source-map',
    })
];
