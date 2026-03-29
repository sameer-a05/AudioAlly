import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Trim and strip optional surrounding quotes from .env values (common copy-paste mistake). */
function cleanEnvValue(v) {
  if (v == null || typeof v !== 'string') return ''
  let s = v.trim()
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  return s
}

export default defineConfig(({ mode }) => {
  // Load `files/.env` even when npm is started from a parent folder.
  const env = loadEnv(mode, __dirname, '')
  const geminiServer = cleanEnvValue(env.GEMINI_API_KEY)
  const geminiVite = cleanEnvValue(env.VITE_GEMINI_API_KEY)
  // Prefer GEMINI_API_KEY first so it stays the single source of truth with FastAPI.
  // A stale/expired VITE_GEMINI_API_KEY must NOT override a valid GEMINI_API_KEY (common 400 "expired" confusion).
  const geminiForClient = geminiServer || geminiVite || ''
  const geminiModel = cleanEnvValue(env.VITE_GEMINI_MODEL) || 'gemini-2.0-flash'

  return {
    envDir: __dirname,
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiForClient),
      'import.meta.env.VITE_GEMINI_MODEL': JSON.stringify(geminiModel),
    },
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/node-api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/node-api/, '/api'),
        },
        '/elevenlabs-api': {
          target: 'https://api.elevenlabs.io',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/elevenlabs-api/, ''),
        },
        '/gemini-api': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/gemini-api/, ''),
        },
      },
    },
  }
})
