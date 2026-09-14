import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite frontend. Serverless API lives in /api and is served by Vercel.
// No secrets are bundled here: only VITE_ prefixed vars reach the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
  },
});
