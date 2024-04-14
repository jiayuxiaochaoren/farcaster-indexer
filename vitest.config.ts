import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15_000,
    // TODO: figure out how to use `Bun.env` instead of the `dotenv` package
    setupFiles: 'dotenv/config', // load variables form .env file
  },
})
