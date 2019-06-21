var webpackConfig = require('./webpack.test.config.js');

module.exports = {
  frameworks: ['mocha', 'chai'],
  files: ['**/*.test.ts'],
  preprocessors: {
    '**/*.ts': ['webpack'],
  },
  webpack: webpackConfig,
  reporters: ['progress'],
  colors: true,
  autoWatch: true,
  concurrency: Infinity,
};
