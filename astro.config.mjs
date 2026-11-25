import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { readdir, mkdir, mkdtemp, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Sanexio.github.io — static site, Tailwind 4 via Vite plugin.
// site = canonical URL (used for sitemap + canonical link tags).
// trailingSlash 'always' keeps GitHub Pages happy with sub-routes.

export default defineConfig({
  integrations: [{
    name: 'preserve-published-dht',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const trash = join(dirname(dirname(fileURLToPath(dir))), '_test-trash');
        await mkdir(trash, { recursive: true });
        const destination = await mkdtemp(join(trash, 'dht-build-'));
        for (const name of await readdir(dir)) {
          if (name === 'dht' || name === 'dht-test' || name.startsWith('dht-abnahme')) {
            await rename(new URL(`${name}/`, dir), join(destination, name));
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
