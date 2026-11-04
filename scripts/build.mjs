// Builds the browser bundles. The Worker itself is bundled by Wrangler at deploy time.
import { build } from 'esbuild';

const common = { bundle: true, minify: true, sourcemap: true, target: ['es2020', 'safari14'], logLevel: 'info' };

await Promise.all([
  build({ ...common, tsconfig: 'tsconfig.client.json', entryPoints: ['src/client/site/main.ts'], outfile: 'public/assets/site.js', format: 'iife' }),
  // Bob loads on demand, only when a visitor opens him.
  build({ ...common, tsconfig: 'tsconfig.client.json', entryPoints: ['src/client/bob/index.ts'], outfile: 'public/assets/bob.js', format: 'iife' }),
  build({
    ...common, entryPoints: ['src/studio/main.tsx'], outfile: 'public/studio/app.js', format: 'iife', tsconfig: 'tsconfig.studio.json',
    jsx: 'automatic', jsxImportSource: 'react', define: { 'process.env.NODE_ENV': '"production"' },
  }),
]);
