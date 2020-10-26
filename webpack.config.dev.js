const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.config.common');
const path = require('path');

const devConfig = {
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
}
module.exports = merge(commonConfig, devConfig);;
