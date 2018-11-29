// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const tsconfig_paths_webpack_plugin_1 = require("tsconfig-paths-webpack-plugin");
const constants_1 = require("../constants");
const common_1 = require("./common");
// tslint:disable-next-line:no-var-requires no-require-imports
const configFileName = path.join(constants_1.ExtensionRootDir, 'tsconfig.extension.json');
// Some modules will be pre-genearted and stored in out/.. dir and they'll be referenced via NormalModuleReplacementPlugin
// We need to ensure they do not get bundled into the output (as they are large).
const existingModulesInOutDir = common_1.getListOfExistingModulesInOutDir();
const config = {
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
        ...common_1.getDefaultPlugins('dependencies')
    ],
    resolve: {
        extensions: ['.ts', '.js'],
        plugins: [
            new tsconfig_paths_webpack_plugin_1.TsconfigPathsPlugin({ configFile: configFileName })
        ]
    },
    output: {
        filename: '[name].js',
        path: path.resolve(constants_1.ExtensionRootDir, 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};
// tslint:disable-next-line:no-default-export
exports.default = config;
