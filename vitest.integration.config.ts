import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/integration.setup.ts'],
    globals: true,
    css: true,
    include: ['src/**/*.integration.test.{ts,tsx}'],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
}); 