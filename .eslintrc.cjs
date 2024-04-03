module.exports = {
  ignorePatterns: ["dist"],
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    /* TODO: Remove only-warn when all eslint warnings are addressed */ "only-warn",
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "prettier",
  ],
  parserOptions: {
    project: ["./tsconfig.json"],
  },
  env: {
    node: true,
  },
  rules: {
    "no-shadow": "error",
    "new-cap": "error",
    "no-console": "error",
  },
};
