module.exports = {
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  importOrder: [
    "^vscode(.*)$",
    "^react(.*)$",
    "^@(.*)$",
    "<THIRD_PARTY_MODULES>",
    "^[./].*(?<!\\.(css))$",
    "\\.(css)$",
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  // See https://github.com/trivago/prettier-plugin-sort-imports/issues/113
  overrides: [
    {
      files: "*.ts",
      options: {
        importOrderParserPlugins: ["typescript"],
      },
    },
  ],
};
