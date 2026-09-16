import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';

// Update this to the real production domain before going live.
// It powers canonical URLs, the sitemap, and Open Graph tags.
export const SITE_URL = 'https://rcrallyhub.netlify.app';

export default defineConfig({
  site: SITE_URL,
  // Server-rendered (not static) so that content edited in /portal — stored
  // in Turso — appears on the live site immediately, with no git commit and
  // no Netlify rebuild. Every page below reads through src/lib/content/*,
  // which queries Turso (through a short in-memory cache) instead of the
  // old astro:content collections.
  output: 'server',
  // `includeFiles` force-includes rollup's Linux native binary in the
  // packaged Netlify Function. Without this, Netlify's function packager
  // (node-file-trace, run by @astrojs/netlify at build time) can't detect
  // rollup's dynamically-computed require() of its own platform binary
  // (rollup/dist/native.js resolves the filename at runtime, which static
  // tracing can't follow), so it silently drops the file from the deployed
  // function -- even though it's correctly present in node_modules and
  // package-lock.json. That's what caused the "Cannot find module
  // @rollup/rollup-linux-x64-gnu" 500s in production: something in this
  // app's own SSR bundle ends up importing `vite` at runtime (via the
  // Layout chunk's use of @astrojs/markdown-remark), and vite's module
  // load path pulls in rollup, so rollup becomes a real runtime dependency
  // of the function even though it's normally build-only.
  adapter: netlify({
    includeFiles: ['node_modules/@rollup/rollup-linux-x64-gnu/**'],
  }),
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],
  image: {
    remotePatterns: [{ protocol: 'https' }],
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    format: 'directory',
  },
});
