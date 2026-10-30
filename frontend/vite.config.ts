import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Local print-service (PLU file + receipts): same-origin in dev so HTTPS/mixed-content is not an issue
      '/__pos-local-service': {
        target: 'http://127.0.0.1:5555',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__pos-local-service/, ''),
      },
    },
  },
})
