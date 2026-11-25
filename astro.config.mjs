import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { readdir, rm } from 'node:fs/promises';

// Sanexio.github.io — static site, Tailwind 4 via Vite plugin.
// site = canonical URL (used for sitemap + canonical link tags).
// trailingSlash 'always' keeps GitHub Pages happy with sub-routes.

export default defineConfig({
  integrations: [{
    name: 'preserve-published-dht',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        for (const name of await readdir(dir)) {
          if (name === 'dht' || name === 'dht-test' || name.startsWith('dht-abnahme')) {
            await rm(new URL(`${name}/`, dir), { recursive: true, force: true });
          }
        }
      }
    }
  }],
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
