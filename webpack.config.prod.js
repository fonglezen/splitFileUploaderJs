const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.config.common');
const path = require('path');

const prodConfig = {
  mode: 'production',
  devtool: "source-map",
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: "babel-loader",
      options: {
        presets: ['@babel/preset-env'],
        cacheDirectory: true,
      }
    }]
  },
  output: {
    filename: 'index.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'split-file-uploader',
    libraryTarget: 'umd',
    publicPath: '/dist/'
  },
}
module.exports = merge(commonConfig, prodConfig);;
