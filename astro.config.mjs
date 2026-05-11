import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ttrpg.183107.xyz',
  integrations: [sitemap()],
  outDir: 'dist',
  publicDir: 'public',
  srcDir: 'src',
  build: {
    assets: 'assets',
  },
  vite: {
    build: {
      cssMinify: true,
      assetsInlineLimit: 0,
    },
  },
});
