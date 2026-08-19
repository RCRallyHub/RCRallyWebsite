import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// Update this to the real production domain before going live.
// It powers canonical URLs, the sitemap, and Open Graph tags.
export const SITE_URL = 'https://rcrallyhub.netlify.app';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
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
