import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Lets the client use the same RFID helper as the server
    alias: {
      '@shared': path.join(projectRoot, 'shared'),
    },
  },

  server: {
    port: 5173,
    strictPort: false,
    // During development the Node.js server only exposes the API
    proxy: {
      '/api': 'http://localhost:3001',
    },
    // The shared folder lives above client/, so Vite has to be allowed to read it
    fs: {
      allow: [projectRoot],
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
