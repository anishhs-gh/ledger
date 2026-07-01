import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  target: 'node20',
  banner: {
    js: '#!/usr/bin/env node',
  },
  clean: true,
})
