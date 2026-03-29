/**
 * Extract PDF text with pdf.js, then ask Gemini for story + 2 questions (JSON).
 * Uses VITE_GEMINI_API_KEY; dev uses `/gemini-api` proxy (vite.config.js).
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import {
  geminiGenerateContentUrl,
  readGeminiHttpError,
  singleUserGenerateBody,
} from '../utils/geminiApi.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MAX_PDF_BYTES = 20 * 1024 * 1024
/** Cap pasted source text so the request stays within practical limits */
const MAX_EXTRACTED_CHARS = 120_000

function extractJsonText(raw) {
  if (!raw || typeof raw !== 'string') return '{}'
  let t = raw.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  }
  return t.trim()
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
async function extractTextFromPdfFile(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjsLib.getDocument({ data })
  const pdf = await loadingTask.promise
  const parts = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    parts.push(line)
  }

  return parts.join('\n').replace(/\s+/g, ' ').trim()
}

/**
 * @param {File} pdfFile
 * @param {number} childAge
 * @param {string} [apiKey]
 * @returns {Promise<{
 *   title: string,
 *   story_text: string,
 *   story: string,
 *   questions: Array<{
 *     id: string,
 *     question_text: string,
 *     correct_answer_keywords: string[],
 *     question: string,
 *     keywords: string[],
 *   }>
 * }>}
 */
export async function generateStoryFromPDF(pdfFile, childAge, apiKey) {
  const key =
    (typeof apiKey === 'string' && apiKey.trim()) ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    ''

  if (!pdfFile || pdfFile.type !== 'application/pdf') {
    throw new Error('Please choose a PDF file.')
  }
  if (pdfFile.size > MAX_PDF_BYTES) {
    throw new Error('PDF is too large. Try a file under 20 MB.')
  }
  if (!key) {
    throw new Error('Missing VITE_GEMINI_API_KEY in .env')
  }

  console.log('📄 Extracting text from PDF with pdf.js…')
  let extractedText = ''
  try {
    extractedText = await extractTextFromPdfFile(pdfFile)
  } catch (e) {
    console.log('❌ PDF parse failed:', e)
    throw new Error('Could not read this PDF. It may be corrupted or protected.')
  }

  if (!extractedText) {
    throw new Error(
      'No text found in this PDF. Scanned pages need OCR; try a text-based PDF.',
    )
  }

  if (extractedText.length > MAX_EXTRACTED_CHARS) {
    console.log(
      '📄 Truncating extracted text from',
      extractedText.length,
      'to',
      MAX_EXTRACTED_CHARS,
    )
    extractedText = `${extractedText.slice(0, MAX_EXTRACTED_CHARS)}\n\n[…truncated…]`
  }

  const age = Number(childAge) || 10

  const userPrompt = `Based on this text from a PDF:

${extractedText}

Create a SHORT story for a ${age} year old and 2 questions.

CONSTRAINTS:
- Story must be 120 words or LESS (quick demo)
- Keep it concise and engaging
- Still include key educational concepts
- Make it fast to read/listen to (judges won't wait long)

Respond with only JSON (use double quotes):
{
  "title": "...",
  "story_text": "... (120 words max) ...",
  "questions": [
    {"id": "q1", "question_text": "...", "correct_answer_keywords": ["kw1", "kw2", "kw3"]},
    {"id": "q2", "question_text": "...", "correct_answer_keywords": ["kw1", "kw2"]}
  ]
}`

  const url = geminiGenerateContentUrl(key)

  console.log('💭 Sending extracted text to Gemini…')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      singleUserGenerateBody(userPrompt, {
        temperature: 0.45,
        maxOutputTokens: 4096,
      }),
    ),
  })

  if (!res.ok) {
    const detail = await readGeminiHttpError(res)
    console.log('❌ Gemini story gen error:', detail)
    throw new Error(
      `Story generation failed: ${detail}. If the key works for your teammate, remove any stale VITE_GEMINI_API_KEY from .env (only GEMINI_API_KEY is needed) and restart npm run dev.`,
    )
  }

  const data = await res.json()
  if (!data.candidates?.length) {
    console.log('❌ No candidates', data)
    throw new Error('No story returned. Try again.')
  }

  const rawText = data.candidates[0]?.content?.parts?.[0]?.text
  const text = typeof rawText === 'string' ? rawText : ''
  let parsed
  try {
    parsed = JSON.parse(extractJsonText(text))
  } catch (e) {
    console.log('❌ JSON parse failed', e)
    throw new Error('Could not parse story from model. Try again.')
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : 'Story'
  const storyText =
    typeof parsed.story_text === 'string'
      ? parsed.story_text.trim()
      : typeof parsed.story === 'string'
        ? parsed.story.trim()
        : ''

  const rawQs = Array.isArray(parsed.questions) ? parsed.questions : []

  if (!storyText) {
    throw new Error('Model returned an empty story.')
  }

  const normalized = rawQs.slice(0, 2).map((q, i) => {
    const questionText =
      String(q?.question_text || q?.question || '').trim() ||
      `Question ${i + 1}?`
    const kws = Array.isArray(q?.correct_answer_keywords)
      ? q.correct_answer_keywords.map((k) => String(k).trim()).filter(Boolean)
      : Array.isArray(q?.keywords)
        ? q.keywords.map((k) => String(k).trim()).filter(Boolean)
        : []
    const id = String(q?.id || `q${i + 1}`).trim() || `q${i + 1}`
    return {
      id,
      question_text: questionText,
      correct_answer_keywords: kws,
      question: questionText,
      keywords: kws,
    }
  })

  while (normalized.length < 2) {
    const n = normalized.length + 1
    normalized.push({
      id: `q${n}`,
      question_text: `What was one main idea from the story? (${n})`,
      correct_answer_keywords: ['story', 'main idea'],
      question: `What was one main idea from the story? (${n})`,
      keywords: ['story', 'main idea'],
    })
  }

  console.log('✅ GeminiStoryGenerator: story + 2 questions ready')
  return {
    title,
    story_text: storyText,
    story: storyText,
    questions: normalized,
  }
}
