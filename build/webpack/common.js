// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const webpack_bundle_analyzer_1 = require("webpack-bundle-analyzer");
const constants_1 = require("../constants");
exports.nodeModulesToExternalize = [
    'unicode/category/Lu',
    'unicode/category/Ll',
    'unicode/category/Lt',
    'unicode/category/Lo',
    'unicode/category/Lm',
    'unicode/category/Nl',
    'unicode/category/Mn',
    'unicode/category/Mc',
    'unicode/category/Nd',
    'unicode/category/Pc'
];
function getDefaultPlugins(name) {
    const plugins = [];
    if (!constants_1.isCI) {
        plugins.push(new webpack_bundle_analyzer_1.BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: `${name}.html`
        }));
    }
    return plugins;
}
exports.getDefaultPlugins = getDefaultPlugins;
