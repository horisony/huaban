import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'fs';
import { createDevApiMiddleware } from './server/devApiMiddleware.js';

function seoBuildPlugin(siteUrl) {
  return {
    name: 'seo-build-files',
    closeBundle() {
      const base = siteUrl.replace(/\/$/, '');
      writeFileSync(
        'dist/robots.txt',
        `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
      );
      writeFileSync(
        'dist/sitemap.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${base}/</loc>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${base}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${base}/?lang=en" />
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = env.VITE_SITE_URL || 'https://huaban.vercel.app';
  Object.assign(process.env, { ...env, VITE_SITE_URL: siteUrl });

  return {
    plugins: [
      react(),
      {
        name: 'dev-api',
        configureServer(server) {
          server.middlewares.use(createDevApiMiddleware());
        },
      },
      seoBuildPlugin(siteUrl),
    ],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
