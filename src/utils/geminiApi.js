/**
 * Shared Gemini REST (Generative Language API) helpers for the browser.
 * Default model is gemini-2.5-flash. Widely available; override with VITE_GEMINI_MODEL in .env
 * (e.g. gemini-2.5-flash) if your key supports it.
 */

export function geminiRestBaseUrl() {
  if (import.meta.env.DEV) return '/gemini-api'
  return 'https://generativelanguage.googleapis.com'
}

export function geminiRestModel() {
  const m = import.meta.env.VITE_GEMINI_MODEL
  return (typeof m === 'string' && m.trim()) || 'gemini-2.5-flash'
}

export function geminiGenerateContentUrl(apiKey) {
  const model = geminiRestModel()
  return `${geminiRestBaseUrl()}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
}

/**
 * Single-turn request body shape from the official REST examples (no `role` required).
 */
export function singleUserGenerateBody(text, generationConfig = {}) {
  return {
    contents: [{ parts: [{ text }] }],
    generationConfig,
  }
}

export async function readGeminiHttpError(res) {
  const raw = await res.text().catch(() => '')
  try {
    const j = JSON.parse(raw)
    const msg = j?.error?.message || j?.error?.status
    return msg ? `${res.status}: ${msg}` : `${res.status}: ${raw.slice(0, 500)}`
  } catch {
    return `${res.status}: ${raw || res.statusText}`
  }
}
