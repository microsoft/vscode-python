// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const path = require('path');
const constants = require('../constants');

const root = path.join(__dirname, '..', '..');

const config = {
    mode: 'production',
    target: 'web',
    entry: {
        extension: path.join(root, './src/client/extension.web.ts'),
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            configFile: "tsconfig.extension.web.json"
                        }
                    },
                ],
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js', '.json']
    },
    externals: ['vscode'],
    output: {
        filename: '[name].js',
        path: path.resolve(constants.ExtensionRootDir, 'out', 'client-web'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]',
    },
};

exports.default = config;
