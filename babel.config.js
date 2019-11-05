
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { ie: 11 }, useBuiltIns: false }],
    '@babel/preset-typescript',
  ],
  plugins: [
    ["@babel/plugin-proposal-class-properties", { "proposal": "minimal" }]
  ]
};
