import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'), // reads VITE_API_URL from the root .env
  server: { port: 5173 },
  test: { environment: 'jsdom', globals: true },
});
