import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Bundle @skillr/shared into the output so the npm package is standalone
  noExternal: ['@skillr/shared'],
});
