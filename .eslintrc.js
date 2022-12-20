module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module",
    project: [
      "./tsconfig.json",
      "./client/tsconfig.json",
      "./server/tsconfig.json",
    ],
  },
  env: {
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    eqeqeq: "error",
    "prefer-const": "error",
    "@typescript-eslint/dot-notation": "error",
    "@typescript-eslint/no-unused-vars": "error",
    curly: "error",
  },
};
