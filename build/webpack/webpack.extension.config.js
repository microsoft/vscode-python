// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const glob = require("glob");
const path = require("path");
const tsconfig_paths_webpack_plugin_1 = require("tsconfig-paths-webpack-plugin");
const webpack = require("webpack");
const webpack_bundle_analyzer_1 = require("webpack-bundle-analyzer");
const constants_1 = require("../constants");
// tslint:disable-next-line:no-var-requires no-require-imports
const WrapperPlugin = require('wrapper-webpack-plugin');
const configFileName = path.join(__dirname, '..', '..', 'tsconfig.extension.json');
// Some modules will be pre-genearted and stored in out/.. dir and they'll be referenced via NormalModuleReplacementPlugin
// We need to ensure they do not get bundled into the output (as they are large).
const existingModulesInOutDir = getListOfExistingModulesInOutDir();
function getListOfExistingModulesInOutDir() {
    const outDir = path.join(constants_1.ExtensionRootDir, 'out', 'client');
    const files = glob.sync('**/*.js', { sync: true, cwd: outDir });
    return files.map(filePath => `./${filePath.slice(0, -3)}`);
}
console.log(existingModulesInOutDir);
const config = {
    mode: 'development',
    target: 'node',
    entry: {
        extension: './src/client/extension.ts',
        // 'debugger/debugAdapter/main': './src/client/debugger/debugAdapter/main.ts'
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
                        loader: '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/build/webpack/loaders/externalizeDependencies.js'
                    }]
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
        // '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/out/client/unicode_category_Lu.js',
        // './unicode_category_Lu',
        // './unicode_category_Lu.js',
        ...existingModulesInOutDir
    ],
    plugins: [
        new webpack_bundle_analyzer_1.BundleAnalyzerPlugin({
            analyzerMode: 'static'
        }),
        new WrapperPlugin({
            test: /\.js$/,
            header: 'require(\'source-map-support\').install();'
        }),
        // new webpack.NormalModuleReplacementPlugin(/unicode\/category\//, (resource) => {
        //     const fileName = path.basename(resource.request);
        //     console.log('resource.request for unicode');
        //     console.log(resource.request);
        //     // resource.request = path.join(constants_1.ExtensionRootDir, 'out', 'client', `unicode_category_${fileName}`);
        //     resource.request = `./unicode_category_${fileName}`;
        // }),
        // new webpack.NormalModuleReplacementPlugin(/@jupyter\/services/, (resource) => {
        //     console.log('resource.request for @jupyter/services');
        //     console.log(resource.request);
        //     resource.request = path.join(constants_1.ExtensionRootDir, 'out', 'client', '@jupyter', 'services');
        // }),
        // new webpack.NormalModuleReplacementPlugin(/azure-storage/, (resource) => {
        //     console.log('resource.request for azure-storage');
        //     console.log(resource.request);
        //     resource.request = path.join(constants_1.ExtensionRootDir, 'out', 'client', 'azure-storage');
        // })
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
