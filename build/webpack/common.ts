
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { isCI } from '../constants';
export const nodeModulesToExternalize = [
    // 'source-map-support',
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
    // '@jupyterlab/services',
    // 'azure-storage',
    // 'lodash',
    // 'request',
    // 'semver',
    // 'glob',
    // 'getos',
    // 'iconv-lite',
    // 'sudo-prompt',
    // 'diff-match-patch',
    // 'xml2js',
    // 'fs-extra',
    // 'vscode-languageclient',
    // 'vscode-debugadapter',
    // 'rxjs'
];

export function getDefaultPlugins(name: 'extension' | 'debugger' | 'dependencies' | 'datascience-ui') {
    const plugins = [];
    if (!isCI) {
        plugins.push(
            new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                reportFilename: `${name}.html`
            })
        );
    }
    return plugins;
}
