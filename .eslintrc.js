module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
    project: [
      "./tsconfig.json",
      "./client/tsconfig.json",
      "./server/tsconfig.json",
    ],
  },
  env: {
    node: true,
  },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    eqeqeq: "error",
    "prefer-const": "error",
    "@typescript-eslint/dot-notation": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/consistent-type-assertions": [
      "error",
      { assertionStyle: "never" },
    ],
    curly: "error",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
