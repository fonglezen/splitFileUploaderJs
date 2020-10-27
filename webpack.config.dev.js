const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.config.common');
const path = require('path');

const devConfig = {
  mode: 'none',
  devtool: "source-map",
  output: {
    filename: 'upload.js',
    path: path.resolve(__dirname, 'demo'),
    library: 'uploader',
    libraryTarget: 'umd'
  },
  // devServer: {
  //   compress: false,
  //   port: 9000,
  //   hot: true,
  //   contentBase: path.join(__dirname, './'),
  //   publicPath: '/demo/',
  // }
}
module.exports = merge(commonConfig, devConfig);;
