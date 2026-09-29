import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  // Relative paths so the built index.html works under Electron's file:// protocol
  base: './',
  build: {
    outDir: 'build',
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
