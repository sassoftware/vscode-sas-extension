/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");

/** @type WebpackConfig */
const browserClientConfig = {
  context: path.join(__dirname, "client"),
  mode: "none",
  target: "webworker", // web extensions run in a webworker context
  entry: {
    extension: "./src/browser/extension.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "client", "dist", "browser"),
    libraryTarget: "commonjs",
  },
  resolve: {
    mainFields: ["browser", "module", "main"],
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {},
    fallback: {
      path: require.resolve("path-browserify"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode", // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
};

/** @type WebpackConfig */
const browserServerConfig = {
  context: path.join(__dirname, "server"),
  mode: "none",
  target: "webworker", // web extensions run in a webworker context
  entry: {
    server: "./src/browser/server.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "server", "dist", "browser"),
    libraryTarget: "var",
    library: "serverExportVar",
  },
  resolve: {
    mainFields: ["browser", "module", "main"],
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {
      "../node": path.resolve(__dirname, "server/src/browser"),
    },
    fallback: {},
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
      {
        test: /\.properties$/,
        exclude: /node_modules/,
        type: "asset/source",
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode", // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
};

/** @type WebpackConfig */
const notebookRendererConfig = {
  context: path.join(__dirname, "client"),
  mode: "none",
  entry: {
    LogRenderer: "./src/components/notebook/renderers/LogRenderer.ts",
    HTMLRenderer: "./src/components/notebook/renderers/HTMLRenderer.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "client", "dist", "notebook"),
    libraryTarget: "module",
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  experiments: {
    outputModule: true,
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
};

module.exports = [
  browserClientConfig,
  browserServerConfig,
  notebookRendererConfig,
];
