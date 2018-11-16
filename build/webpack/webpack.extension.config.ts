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
const WrapperPlugin = require('wrapper-webpack-plugin');
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
    mode: 'production',
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
        new WrapperPlugin({
            test: /\.js$/,
            header: 'require(\'source-map-support\').install();'
        })
        // new webpack.NormalModuleReplacementPlugin(/unicode\/category\//, (resource: { request: string }) => {
        //     const fileName = path.basename(resource.request);
        //     resource.request = path.join(ExtensionRootDir, 'out', 'client', `unicode_category_${fileName}`);
        // }),
        // new webpack.NormalModuleReplacementPlugin(/@jupyter\/services/, (resource: { request: string }) => {
        //     resource.request = path.join(ExtensionRootDir, 'out', 'client', '@jupyter', 'services');
        // }),
        // new webpack.NormalModuleReplacementPlugin(/azure-storage/, (resource: { request: string }) => {
        //     resource.request = path.join(ExtensionRootDir, 'out', 'client', 'azure-storage');
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
