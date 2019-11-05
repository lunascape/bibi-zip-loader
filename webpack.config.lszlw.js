const path = require('path');
const WebpackSynchronizableShellPlugin = require('webpack-synchronizable-shell-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: [path.resolve(__dirname, "./src/lszlw/lszlw.ts")],
  target: 'webworker',
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "lszlw.js"
  },
  plugins: [
    new WebpackSynchronizableShellPlugin({
      onBuildStart: {
        scripts: [path.resolve(__dirname, './wasm/build.sh')],
        blocking: true
      }
    }),
  ],
  module: {
    rules: [
      {
        test: /\.[tj]s$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader'
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  devServer: {
    disableHostCheck: true
  }
};
