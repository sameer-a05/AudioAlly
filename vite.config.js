import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Python FastAPI (Story Engine + Evaluation)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Node.js (PDF upload + document management)
      '/node-api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/node-api/, '/api'),
      },
      // ElevenLabs TTS (proxied to avoid CORS)
      '/elevenlabs-api': {
        target: 'https://api.elevenlabs.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/elevenlabs-api/, ''),
      },
      // Gemini (avoids browser CORS in dev; prod may need backend proxy)
      '/gemini-api': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/gemini-api/, ''),
      },
    },
  },
})