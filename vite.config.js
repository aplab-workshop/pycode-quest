import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: served from https://<user>.github.io/pycode-quest/ on GitHub Pages;
// dev server stays at /
export default defineConfig(({ command }) => ({
  plugins: [react()],
  worker: { format: 'es' },
  base: command === 'build' ? '/pycode-quest/' : '/',
}));
