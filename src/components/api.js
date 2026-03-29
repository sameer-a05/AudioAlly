/**
 * AudioAlly API Client
 * =====================
 * Talks to both the Node PDF server and the Python Story Engine.
 * In dev, Vite proxies handle routing:
 *   /node-api/*  → Node.js :3000
 *   /api/*       → FastAPI :8000
 */

const NODE_BASE = '/node-api'
const PYTHON_BASE = '/api'

/**
 * Upload a PDF and get back a document_id + extracted text preview
 */
export async function uploadPdf(file) {
  const formData = new FormData()
  formData.append('pdf', file)

  const res = await fetch(`${NODE_BASE}/upload-pdf`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.detail || `Upload failed: ${res.status}`)
  }

  return res.json()
  // → { document_id, filename, text_length, text_preview }
}

/**
 * List previously uploaded documents
 */
export async function listDocuments() {
  const res = await fetch(`${NODE_BASE}/documents`)
  if (!res.ok) return []
  return res.json()
}

/**
 * Generate an interactive story
 * @param {object} params - { content?, topic?, document_id?, child_age, learning_needs, num_questions }
 * @returns {Promise<object>} GeneratedStory JSON
 */
export async function generateStory(params) {
  const res = await fetch(`${PYTHON_BASE}/generate-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Story generation failed: ${res.status}`)
  }

  return res.json()
}

/**
 * Evaluate a child's spoken answer
 * @param {object} questionSegment - The question segment from the story
 * @param {string} childAnswerText - Transcribed answer
 * @param {number} childAge
 * @param {string[]} learningNeeds
 * @returns {Promise<{result: string, encouragement: string, explanation: string|null}>}
 */
export async function evaluateAnswer(questionSegment, childAnswerText, childAge = 10, learningNeeds = ['none']) {
  const res = await fetch(`${PYTHON_BASE}/evaluate-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_segment: questionSegment,
      child_answer_text: childAnswerText,
      child_age: childAge,
      learning_needs: learningNeeds,
    }),
  })

  if (!res.ok) {
    // On any failure, return "unclear" — never punish the child
    return {
      result: 'unclear',
      encouragement: "Hmm, something went wrong on our end. Let's keep going!",
      explanation: null,
    }
  }

  return res.json()
}

/**
 * Health check
 */
export async function healthCheck() {
  try {
    const res = await fetch(`${PYTHON_BASE}/health`)
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}
