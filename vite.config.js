import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/elevenlabs-api': {
        target: 'https://api.elevenlabs.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/elevenlabs-api/, ''),
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
