const path = require('path');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require('webpack');

module.exports = (env, args) => {
  const lszlConfigs = require('./webpack.config.lszl')(env, args);
  return [
    ...lszlConfigs,
    {
      mode: 'development',
      entry: ['./static/index.ts'],
      output: {
        path: path.resolve(__dirname, "dist"),
        filename: "index.js"
      },
      plugins: [
        new CopyWebpackPlugin([{ from: './static', ignore: ['.*', '*.ts', '.js'] }])
      ],
      module: {
        rules: [
          {
            test: /\.[tj]s$/,
            exclude: /(node_modules|bower_components)/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: [
                  ['@babel/preset-env', { targets: { ie: 11 }, useBuiltIns: 'usage', corejs: 3 }],
                  '@babel/preset-typescript',
                ],
                plugins: [
                  ["@babel/plugin-proposal-class-properties", { "proposal": "minimal" }]
                ]
              }
            }
          }
        ]
      },
      resolve: {
        extensions: [".ts", ".js"]
      },
      devServer: {
        disableHostCheck: true
      },
      externals: [
        {
          LSZL: true,
        }
      ]
    }
  ];
}
