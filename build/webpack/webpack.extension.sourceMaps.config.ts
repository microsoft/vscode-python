// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import * as webpack from 'webpack';
import { ExtensionRootDir } from '../constants';
import { getDefaultPlugins, getListOfExistingModulesInOutDir } from './common';

// tslint:disable-next-line:no-var-requires no-require-imports
const configFileName = path.join(ExtensionRootDir, 'tsconfig.extension.json');

// Some modules will be pre-genearted and stored in out/.. dir and they'll be referenced via NormalModuleReplacementPlugin
// We need to ensure they do not get bundled into the output (as they are large).
const existingModulesInOutDir = getListOfExistingModulesInOutDir();

const config: webpack.Configuration = {
    mode: 'production',
    target: 'node',
    entry: {
        sourceMapSupport: './src/client/sourceMapSupport.ts'
    },
    devtool: 'source-map',
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
    externals: [
        'vscode',
        'commonjs',
        ...existingModulesInOutDir
    ],
    plugins: [
        ...getDefaultPlugins('dependencies')
    ],
    resolve: {
        extensions: ['.ts', '.js'],
        plugins: [
            new TsconfigPathsPlugin({ configFile: configFileName })
        ]
    },
    output: {
        filename: '[name].js',
        path: path.resolve(ExtensionRootDir, 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};

// tslint:disable-next-line:no-default-export
export default config;
