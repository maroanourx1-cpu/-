import { defineConfig } from 'vite';

// base './' يخلي النسخة المبنية تشتغل من أي مجلد
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
