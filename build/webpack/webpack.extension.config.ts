// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as glob from 'glob';
import * as path from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import * as webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { ExtensionRootDir } from '../constants';

// tslint:disable-next-line:no-var-requires no-require-imports
// const WrapperPlugin = require('wrapper-webpack-plugin');
const configFileName = path.join(ExtensionRootDir, 'tsconfig.extension.json');

// Some modules will be pre-genearted and stored in out/.. dir and they'll be referenced via NormalModuleReplacementPlugin
// We need to ensure they do not get bundled into the output (as they are large).
const existingModulesInOutDir = getListOfExistingModulesInOutDir();
function getListOfExistingModulesInOutDir() {
    const outDir = path.join(ExtensionRootDir, 'out', 'client');
    const files = glob.sync('**/*.js', { sync: true, cwd: outDir });
    return files.map(filePath => `./${filePath.slice(0, -3)}`);
}

const config: webpack.Configuration = {
    mode: 'development',
    target: 'node',
    entry: {
        extension: './src/client/extension.ts',
        'debugger/debugAdapter/main': './src/client/debugger/debugAdapter/main.ts'
    },
    devtool: 'source-map',
    node: {
        __dirname: false
    },
    module: {
        rules: [
            {
                // JupyterServices imports node-fetch using `eval`.
                test: require.resolve('@jupyterlab/services'),
                use: 'imports-loader?_node_fetch=node-fetch'
            },
            {
                // JupyterServices imports node-fetch using `eval`.
                test: require.resolve('@jupyterlab/services'),
                use: 'imports-loader?_ws=ws'
            },
            // {
            //     // Ensure source-map-support is injected as a
            //     test: /src\/client\/extension.ts$/,
            //     use: 'imports-loader?_source_map_support=source-map-support'
            // },
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: path.join(__dirname, 'loaders', 'externalizeDependencies.js')
                    }
                ]
            },
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
        new BundleAnalyzerPlugin({
            analyzerMode: 'static'
        }),
        // new WrapperPlugin({
        //     test: /\.js$/,
        //     header: 'require(\'./node_modules/source-map-support\').install();'
        // })
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
