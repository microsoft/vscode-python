module.exports = {
  mode: 'development',
  node: {
    fs: 'empty',
  },
  module: {
    rules: [
      {
        test: /\.txt/,
        use: ['raw-loader'],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.tsx?$/,
        use: ['ts-loader'],
      },
      {
        test: /\.png$/,
        use: ['file-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx', '.css'],
    modules: ['node_modules'],
  },
};
