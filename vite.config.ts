import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/](?!qrcode\.react[\\/])/ },
          ],
        },
      },
    },
  },
  test: {
    coverage: { provider: 'v8', include: ['src/**/*.{ts,tsx}'], exclude: ['src/**/*.test.{ts,tsx}', 'src/components/ui/**'] },
  },
  server: {
    proxy: { '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:8000' } },
  },
})
