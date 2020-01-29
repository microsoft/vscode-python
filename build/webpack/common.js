// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

const glob = require('glob');
const path = require('path');
const webpack_bundle_analyzer = require('webpack-bundle-analyzer');
const constants = require('../constants');
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
    'diff-match-patch',
    'sudo-prompt',
    'node-stream-zip',
    'xml2js',
    'vsls/vscode',
    'pdfkit',
    'crypto-js',
    'fontkit',
    'linebreak',
    'png-js',
    '@koa/cors',
    'koa',
    'koa-compress',
    'koa-logger'
];
exports.nodeModulesToReplacePaths = [...exports.nodeModulesToExternalize];
function getDefaultPlugins(name) {
    const plugins = [];
    // If we're in watch mode, then don't display the analyzer output html file.
    // Similarly if generating webpack stats file, then no need of displaying the analyzer results.
    const doNotOpenAnalyzer = process.argv.includes('--watch') || process.argv.includes('--profile');
    plugins.push(
        new webpack_bundle_analyzer.BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: `${name}.analyzer.html`,
            generateStatsFile: true,
            statsFilename: `${name}.stats.json`,
            openAnalyzer: !constants.isCI && !doNotOpenAnalyzer
        })
    );
    return plugins;
}
exports.getDefaultPlugins = getDefaultPlugins;
function getListOfExistingModulesInOutDir() {
    const outDir = path.join(constants.ExtensionRootDir, 'out', 'client');
    const files = glob.sync('**/*.js', { sync: true, cwd: outDir });
    return files.map(filePath => `./${filePath.slice(0, -3)}`);
}
exports.getListOfExistingModulesInOutDir = getListOfExistingModulesInOutDir;
