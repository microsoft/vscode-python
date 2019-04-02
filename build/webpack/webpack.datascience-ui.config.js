// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const common_1 = require("./common");
// tslint:disable-next-line:no-var-requires no-require-imports
const FixDefaultImportPlugin = require('webpack-fix-default-import-plugin');
const configFileName = 'tsconfig.datascience-ui.json';
const config = {
    entry: ['babel-polyfill', './src/datascience-ui/history-react/index.tsx'],
    output: {
        path: path.join(__dirname, '..', '..', 'out'),
        filename: 'datascience-ui/history-react/index_bundle.js',
        publicPath: path.join(__dirname, '..', '..')
    },
    mode: 'production',
    // Use 'eval' for release and `eval-source-map` for development.
    // We need to use one where source is embedded, due to webviews (they restrict resources to specific schemes,
    // this seems to prevent chrome from downloading the source maps)
    devtool: 'eval',
    node: {
        fs: 'empty'
    },
    plugins: [
        ...common_1.getDefaultPlugins('datascience-ui'),
        new HtmlWebpackPlugin({ template: 'src/datascience-ui/history-react/index.html', filename: 'datascience-ui/history-react/index.html' }),
        new FixDefaultImportPlugin(),
        new CopyWebpackPlugin([
            { from: './**/*.png', to: '.' },
            { from: './**/*.svg', to: '.' },
            { from: './**/*.css', to: '.' },
            { from: './**/*theme*.json', to: '.' }
        ])
    ],
    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: ['.ts', '.tsx', '.js', '.json']
    },
    module: {
        rules: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'awesome-typescript-loader',
                    options: {
                        configFileName,
                        reportFiles: [
                            'src/datascience-ui/**/*.{ts,tsx}'
                        ]
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.js$/,
                include: /node_modules.*remark.*default.*js/,
                use: [
                    {
                        loader: path.resolve('./build/datascience/remarkLoader.js'),
                        options: {}
                    }
                ]
            },
            {
                test: /\.json$/,
                type: 'javascript/auto',
                include: /node_modules.*remark.*/,
                use: [
                    {
                        loader: path.resolve('./build/webpack/loaders/jsonloader.js'),
                        options: {}
                    }
                ]
            },
            {
                test: /\.scss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader'
                ]
            }
        ]
    }
};
// tslint:disable-next-line:no-default-export
exports.default = config;
