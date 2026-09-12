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
  adapter: netlify(),
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
