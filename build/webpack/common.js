// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const glob = require("glob");
const path = require("path");
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
    'unicode/category/Pc',
    '@jupyterlab/services',
    'azure-storage',
    'request',
    'request-progress',
    'source-map-support',
    'file-matcher',
    'diff-match-patch',
    'sudo-prompt',
    'node-stream-zip',
    'xml2js'
];
function getDefaultPlugins(name) {
    const plugins = [];
    if (!constants_1.isCI) {
        plugins.push(new webpack_bundle_analyzer_1.BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: `${name}.analyzer.html`
        }));
    }
    return plugins;
}
exports.getDefaultPlugins = getDefaultPlugins;
function getListOfExistingModulesInOutDir() {
    const outDir = path.join(constants_1.ExtensionRootDir, 'out', 'client');
    const files = glob.sync('**/*.js', { sync: true, cwd: outDir });
    return files.map(filePath => `./${filePath.slice(0, -3)}`);
}
exports.getListOfExistingModulesInOutDir = getListOfExistingModulesInOutDir;
