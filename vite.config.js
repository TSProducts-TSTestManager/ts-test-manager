import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://187.127.178.233:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://187.127.178.233:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  // @ts-expect-error vitest/config
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setupTests.ts'],
    // The jsdom suite renders large components (virtualized tables, modals);
    // under parallel workers the default 5s can be exceeded.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
