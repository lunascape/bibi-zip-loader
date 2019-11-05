const path = require('path');
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const entry = [];
  entry.push(path.resolve(__dirname, "./src/lszl/lszl.ts"));
  return [
    require('./webpack.config.lszlw'),
    {
      mode: 'development',
      entry,
      output: {
        path: path.resolve(__dirname, "./dist"),
        filename: "lszl.js",
        library: 'LSZL',
        libraryTarget: 'umd',
        libraryExport: 'default',
      },
      plugins: [
        new CopyWebpackPlugin([
          './static/lszl.d.ts'
        ]),
      ],
      module: {
        rules: [
          {
            test: /\.[jt]s$/,
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
    }
  ];
};
