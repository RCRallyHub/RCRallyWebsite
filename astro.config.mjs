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
  // `includeFiles` force-includes binaries that Netlify's function packager
  // (node-file-trace, run by @astrojs/netlify at build time) fails to
  // detect because they're loaded through a runtime-computed path rather
  // than a static import/require -- so it silently drops them from the
  // deployed function even though they're correctly on disk:
  //  - rollup's Linux native binary: rollup/dist/native.js does
  //    require('@rollup/rollup-' + platform) at runtime. Something in this
  //    app's own SSR bundle (Layout.astro's chunk graph, via
  //    @astrojs/markdown-remark) ends up importing `vite` at runtime, and
  //    vite's module load path pulls in rollup, so rollup becomes a real
  //    runtime dependency of the function even though it's normally
  //    build-only. This was the "Cannot find module
  //    @rollup/rollup-linux-x64-gnu" 500s.
  //  - netlify-redirector's WASM binary: used internally by the Netlify
  //    adapter's generated handler to apply this project's _redirects
  //    rules (see netlify.toml) on every request, loaded via a
  //    scriptDirectory-relative path at runtime. Missing this one crashes
  //    every request with a generic "This function has crashed" page.
  adapter: netlify({
    includeFiles: [
      'node_modules/@rollup/rollup-linux-x64-gnu/**',
      'node_modules/netlify-redirector/lib/*.wasm',
    ],
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
