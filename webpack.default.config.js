// Default configuration for webpacking react scripts
var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');

module.exports = {
  entry: '<unknown>',
  mode: 'development', // Maybe change this to production? Do we care if users see errors?
  devtool: 'cheap-module-source-map',  
  output: {
    path: path.resolve(__dirname, './out'),
    filename: 'index_bundle.js',
    publicPath: './'
  },
  plugins: [new HtmlWebpackPlugin(
      {
          template: '<unknown>',
      }
  )],
  module: {
    rules: [
        {
            test: /\.(js|jsx)$/,
            exclude: /node_modules/,
            use: {
                loader: "babel-loader",
                options: {
                    presets: ['@babel/preset-env', '@babel/preset-react']
                }
            }
        },
        // {
        //     test: /\.svg$/,
        //     loader: 'svg-inline-loader?idPrefix',
        // },
        {
            test: /\.css$/,
            use: [
                "style-loader",
                "css-loader"
            ]
        },
          // "file" loader makes sure those assets get served by WebpackDevServer.
          // When you `import` an asset, you get its (virtual) filename.
          // In production, they would get copied to the `build` folder.
          // This loader doesn't use a "test" so it will catch all modules
          // that fall through the other loaders.
          {
            // Exclude `js` files to keep "css" loader working as it injects
            // its runtime that would otherwise processed through "file" loader.
            // Also exclude `html` and `json` extensions so they get processed
            // by webpacks internal loaders.
            exclude: [/\.(js|jsx|mjs|css)$/, /\.html$/, /\.json$/],
            loader: require.resolve('url-loader'),
            // options: {
            //   name: 'static/media/[name].[hash:8].[ext]',
            // },
          }
    ]
}  
};

