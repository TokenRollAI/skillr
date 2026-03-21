import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'index': 'src/entry-node.ts' },
    format: ['esm'],
    target: 'node18',
    clean: true,
    shims: true,
    outDir: 'dist',
  },
]);
