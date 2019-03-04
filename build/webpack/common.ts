// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as glob from 'glob';
import * as path from 'path';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { ExtensionRootDir, isCI } from '../constants';

export const nodeModulesToExternalize = [
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
    'vsls/vscode'
];

export function getDefaultPlugins(name: 'extension' | 'debugger' | 'dependencies' | 'datascience-ui') {
    const plugins = [];
    if (!isCI) {
        plugins.push(
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                reportFilename: `${name}.analyzer.html`
            })
        );
    }
    return plugins;
}

export function getListOfExistingModulesInOutDir() {
    const outDir = path.join(ExtensionRootDir, 'out', 'client');
    const files = glob.sync('**/*.js', { sync: true, cwd: outDir });
    return files.map(filePath => `./${filePath.slice(0, -3)}`);
}
