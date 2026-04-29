import { build } from 'esbuild'

await Promise.all([
  build({
    entryPoints: ['./in-browser-testing-libs.ts'],
    outfile: './index.js',
    bundle: true,
    external: [],
    platform: 'browser',
    format: 'esm',
  }),
  build({
    entryPoints: ['./dist/index.js'],
    outfile: './test/e2e/runsInBrowsers/browser-dist.js',
    bundle: true,
    external: ['node:*'],
    platform: 'browser',
    format: 'esm',
    treeShaking: true,
  }),
])
