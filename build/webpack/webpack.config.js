// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const merge = require('webpack-merge');
const datascience = require('./webpack.datascience-ui.config.js');
const extensionDependencies = require('./webpack.extension.dependencies.config.js').default;

const configurations = [
    // history-react
    merge(datascience[0], {
        devtool: 'eval'
    }),
    // native-editor
    merge(datascience[1], {
        devtool: 'eval'
    }),
    // data-explorer
    merge(datascience[2], {
        devtool: 'eval'
    }),
    // plot
    merge(datascience[3], {
        devtool: 'eval'
    }),
    merge(extensionDependencies, {
        mode: 'production',
        devtool: 'source-map'
    })
];

// Dirty temporary hack.
// If the environment variable BUNDLE_INDEX is defined, then return just one item in the array.
// Refer issue for further details (https://github.com/microsoft/vscode-python/issues/9055)
if (process.env.BUNDLE_INDEX) {
    console.info(`Using Optimized Build, Bundle Index ${process.env.BUNDLE_INDEX}`);
    module.exports = [configurations[parseInt(process.env.BUNDLE_INDEX, 10)]];
} else {
    console.info('Not using Optimized Build');
    module.exports = configurations;
}
