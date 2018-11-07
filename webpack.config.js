const merge = require('webpack-merge');
const datascience = require('./webpack.datascience-ui.config.js');

module.exports = [merge(datascience, {
    devtool: 'eval'
})];
