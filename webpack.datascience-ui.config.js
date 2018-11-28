const HtmlWebpackPlugin = require('html-webpack-plugin');
const FixDefaultImportPlugin = require('webpack-fix-default-import-plugin');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin')

const configFileName = 'tsconfig.datascience-ui.json';

module.exports = {
    entry: ['babel-polyfill', './src/datascience-ui/history-react/index.tsx'],
    output: {
        path: path.join(__dirname, 'out'),
        filename: 'datascience-ui/history-react/index_bundle.js',
        publicPath: './'
    },

    mode: 'development', // Leave as is, we'll need to see stack traces when there are errors.
    // Use 'eval' for release and `eval-source-map` for development.
    // We need to use one where source is embedded, due to webviews (they restrict resources to specific schemes,
    //  this seems to prevent chrome from downloading the source maps)
    devtool: 'eval-source-map',
    node: {
        fs: 'empty'
    },
    plugins: [
        new HtmlWebpackPlugin({ template: 'src/datascience-ui/history-react/index.html', imageBaseUrl: `${__dirname.replace(/\\/g, '/')}/out/datascience-ui/history-react`, indexUrl: `${__dirname}/out/1`, filename: './datascience-ui/history-react/index.html' }),
        new FixDefaultImportPlugin(),
        new CopyWebpackPlugin([
            { from: './**/*.png', to: '.' },
            { from: './**/*.svg', to: '.' },
            { from: './**/*.css', to: '.' },
            { from: './**/*theme*.json', to: '.' }
        ], { context: 'src' }),
    ],
    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".ts", ".tsx", ".js", ".json"]
    },

    module: {
        rules: [
            // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
            {
                test: /\.tsx?$/,
                use: {
                    loader: "awesome-typescript-loader",
                    options: {
                        configFileName,
                        reportFiles: [
                            'src/datascience-ui/**/*.{ts,tsx}'
                        ]
                    },
                }
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ],
            },
            {
                test: /\.js$/,
                include: /node_modules.*remark.*default.*js/,
                use: [
                    {
                        loader: path.resolve('./build/webpack/loaders/remarkLoader.js'),
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
            }
        ]
    }
};
