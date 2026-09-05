import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    // Vercel resolves its output directory from the repo root, so the bundle
    // has to land in <repo>/dist rather than apps/web/dist.
    outDir: '../../dist',
    emptyOutDir: true,
    // 144 font stylesheets each become their own tiny chunk, so the default
    // warning fires constantly and hides real problems.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Media decoding is only needed once a project is open, and it is by
          // far the largest dependency - splitting it keeps the dashboard and
          // the gallery light on a phone.
          if (id.includes('mediabunny')) return 'media';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
          if (id.includes('dexie') || id.includes('zustand') || id.includes('zod')) return 'state';
          return undefined;
        },
      },
    },
  },
});
