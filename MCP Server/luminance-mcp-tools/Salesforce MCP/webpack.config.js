const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  target: "node",
  mode: "production",
  entry: "./src/index.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs2",
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: "README.md", to: "README.md" },
        { from: "assets/icon.png", to: "icon.png" },
      ],
    }),
  ],
  optimization: {
    minimize: true,
  },
};