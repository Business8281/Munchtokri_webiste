module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": 0,
    "import/no-unresolved": 0,
    "indent": 0,
    "object-curly-spacing": 0,
    "max-len": 0,
    "comma-dangle": 0,
    "no-trailing-spaces": 0,
    "no-unused-vars": 0,
    "@typescript-eslint/no-unused-vars": 0,
    "google-camelcase/google-camelcase": 0,
    "require-jsdoc": 0,
    "valid-jsdoc": 0,
  },
};
