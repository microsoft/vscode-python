// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const webpack_bundle_analyzer_1 = require("webpack-bundle-analyzer");
const config = {
    mode: 'production',
    target: 'node',
    entry: {
        unicode_category_Lu: './node_modules/unicode/category/Lu',
        unicode_category_Ll: './node_modules/unicode/category/Ll',
        unicode_category_Lt: './node_modules/unicode/category/Lt',
        unicode_category_Lo: './node_modules/unicode/category/Lo',
        unicode_category_Lm: './node_modules/unicode/category/Lm',
        unicode_category_Nl: './node_modules/unicode/category/Nl',
        unicode_category_Mn: './node_modules/unicode/category/Mn',
        unicode_category_Mc: './node_modules/unicode/category/Mc',
        unicode_category_Nd: './node_modules/unicode/category/Nd',
        unicode_category_Pc: './node_modules/unicode/category/Pc',
        '@jupyterlab/services': './node_modules/@jupyterlab/services',
        'azure-storage': './node_modules/azure-storage'
    },
    devtool: 'source-map',
    node: {
        __dirname: false
    },
    externals: [
        'commonjs'
    ],
    plugins: [
        new webpack_bundle_analyzer_1.BundleAnalyzerPlugin({
            analyzerMode: 'static'
        })
    ],
    resolve: {
        extensions: ['.js']
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, '..', '..', 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};
// tslint:disable-next-line:no-default-export
exports.default = config;
