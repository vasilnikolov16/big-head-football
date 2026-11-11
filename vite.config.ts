import { defineConfig } from 'vite';

// base: './' makes the build work from any sub-folder (e.g. GitHub Pages /repo-name/).
export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
