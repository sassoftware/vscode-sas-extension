module.exports = {
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  importOrder: [
    "^react(.*)$",
    "^@(.*)$",
    "<THIRD_PARTY_MODULES>",
    "^[./].*(?<!.(css|scss|css.json|properties))$",
    // ".(properties)$",
    // ".(css|scss|css.json)$",
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
