module.exports = {
  ignorePatterns: ['dist', '.eslintrc.cjs', 'vitest.config.ts', 'ignore'],
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'justinanastos',
    /* TODO: Remove only-warn when all eslint warnings are addressed */ 'only-warn',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier',
  ],
  parserOptions: {
    project: ['./tsconfig.json'],
  },
  env: {
    node: true,
  },
  rules: {
    'no-shadow': 'error',
    'new-cap': 'error',
    'no-console': 'error',
    'object-shorthand': 'error',
    'justinanastos/switch-braces': 'error',
  },
}
