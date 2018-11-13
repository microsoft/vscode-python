// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';

// tslint:disable-next-line:no-default-export
export default {
    mode: 'production',
    target: 'node',
    entry: {
        unicode_category_Lu: './node_modules/unicode/category/Lu.js',
        unicode_category_Ll: './node_modules/unicode/category/Ll.js',
        unicode_category_Lt: './node_modules/unicode/category/Lt.js',
        unicode_category_Lo: './node_modules/unicode/category/Lo.js',
        unicode_category_Nl: './node_modules/unicode/category/Nl.js',
        unicode_category_Mn: './node_modules/unicode/category/Mn.js',
        unicode_category_Mc: './node_modules/unicode/category/Mc.js',
        unicode_category_Nd: './node_modules/unicode/category/Nd.js',
        unicode_category_Pc: './node_modules/unicode/category/Pc.js'
    },
    devtool: 'none', // Using 'source-map' causes issues when building the bundle.
    node: {
        __dirname: false
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, '..', '..', 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    }
};
