
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as webpack from 'webpack';
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

// tslint:disable-next-line:no-any
function progressReporter(percentage: any, message: any, ...args: any[]) {
    // tslint:disable-next-line:no-console
    console.info(percentage, message, ...args);
}

export function getDefaultPlugins(name: 'extension' | 'debugger' | 'dependencies' | 'datascience-ui') {
    const plugins = [new webpack.ProgressPlugin(progressReporter)];
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
