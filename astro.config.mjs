import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Sanexio.github.io — static site, Tailwind 4 via Vite plugin.
// site = canonical URL (used for sitemap + canonical link tags).
// trailingSlash 'always' keeps GitHub Pages happy with sub-routes.

export default defineConfig({
  site: 'https://sanexio.github.io',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory'
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
