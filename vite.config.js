import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/3ditorJS/' : '/',
  server: {
    host: 'localhost',
  },
});
