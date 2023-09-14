// take default
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
};
