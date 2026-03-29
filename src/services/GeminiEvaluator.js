/**
 * Client-side Gemini evaluation for story answers (generous, ADHD/ESL-friendly).
 * Uses VITE_GEMINI_API_KEY. In dev, requests go through Vite proxy `/gemini-api` to avoid CORS.
 */

function geminiBaseUrl() {
  if (import.meta.env.DEV) return '/gemini-api'
  return 'https://generativelanguage.googleapis.com'
}

/**
 * Strip optional markdown code fences from model output.
 */
function extractJsonText(raw) {
  if (!raw || typeof raw !== 'string') return '{}'
  let t = raw.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  }
  return t.trim()
}

function keywordsToString(segment) {
  const k = segment?.correct_answer_keywords
  if (Array.isArray(k)) return k.join(', ')
  if (typeof k === 'string') return k
  return ''
}

/**
 * Simple API: evaluate a free-text answer against a question + keyword list.
 * @param {string} answer - Child's answer (e.g. from speech-to-text)
 * @param {string} question - Question text
 * @param {string[]|string} keywords - Expected keywords or comma-separated string
 * @param {number} age - Child's age
 * @param {string} [apiKey] - Gemini key (defaults to VITE_GEMINI_API_KEY)
 * @returns {Promise<{ isCorrect: boolean | null, feedback: string, error?: boolean }>}
 */
export async function evaluateAnswer(answer, question, keywords, age, apiKey) {
  const key =
    (typeof apiKey === 'string' && apiKey.trim()) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    ''

  let kwList = []
  if (Array.isArray(keywords)) {
    kwList = keywords.map((k) => String(k).trim()).filter(Boolean)
  } else if (typeof keywords === 'string') {
    kwList = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  }

  const segment = {
    question_text: String(question || ''),
    correct_answer_keywords: kwList,
  }

  const res = await evaluateAnswerWithGemini(
    String(answer || ''),
    segment,
    Number(age) || 10,
    [],
    key,
  )

  return {
    isCorrect: res.isCorrect,
    feedback: res.feedback,
    confidence: res.confidence ?? null,
    ...(res.error ? { error: true } : {}),
  }
}

/**
 * @param {string} childAnswer
 * @param {object} questionSegment - story question segment
 * @param {number} childAge
 * @param {string[]} [learningNeeds]
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<{
 *   isCorrect: boolean | null,
 *   confidence: number | null,
 *   feedback: string,
 *   explanation: string | null,
 *   error: boolean,
 *   result: 'correct'|'incorrect'|'unclear'
 * }>}
 */
export async function evaluateAnswerWithGemini(childAnswer, questionSegment, childAge, learningNeeds = [], apiKey) {
  const questionText =
    questionSegment?.question_text || questionSegment?.text || ''
  const keywords = keywordsToString(questionSegment)
  const needs = learningNeeds?.length ? learningNeeds.join(', ') : 'none'

  const prompt = `You are evaluating a student's answer to an educational story question.

Question: ${questionText}
Correct answer keywords: ${keywords}
Child's age: ${childAge}
Learning context (ADHD, ESL, etc.): ${needs}
Child's spoken answer: ${childAnswer}

Evaluate if the child demonstrated understanding. Be VERY generous and forgiving since this is for ADHD and ESL students.
Accept variations, paraphrasing, approximate answers, and creative responses.
Even partial understanding should be marked as correct.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "isCorrect": true,
  "confidence": 85,
  "feedback": "Friendly, encouraging message (2-3 sentences)",
  "explanation": "Brief explanation of the correct answer"
}

Make feedback positive and encouraging even if answer is wrong. Focus on what they got right.
Use simple language. Be warm and supportive.`

  if (!apiKey) {
    console.log('❌ GeminiEvaluator: missing API key')
    return {
      isCorrect: null,
      confidence: null,
      feedback: "We couldn't evaluate. Please try again.",
      explanation: null,
      error: true,
      result: 'unclear',
    }
  }

  const url = `${geminiBaseUrl()}/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`

  console.log('💭 Gemini evaluation request for question:', questionSegment?.id)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      console.log('❌ Gemini API error:', res.status, errText)
      return {
        isCorrect: null,
        confidence: null,
        feedback: "We couldn't evaluate. Please try again.",
        explanation: null,
        error: true,
        result: 'unclear',
      }
    }

    const data = await res.json()

    if (!data.candidates?.length) {
      console.log('❌ Gemini: no candidates', data?.error || data)
      return {
        isCorrect: null,
        confidence: null,
        feedback: "We couldn't evaluate. Please try again.",
        explanation: null,
        error: true,
        result: 'unclear',
      }
    }

    const rawText = data.candidates[0]?.content?.parts?.[0]?.text
    let text = typeof rawText === 'string' ? rawText : JSON.stringify(data)

    if (data.error) {
      console.log('❌ Gemini response error field:', data.error)
      throw new Error(data.error?.message || 'Gemini error')
    }

    const jsonStr = extractJsonText(text)
    let parsed
    try {
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      console.log('❌ Gemini JSON parse failed:', e, jsonStr?.slice(0, 200))
      return {
        isCorrect: null,
        confidence: null,
        feedback: "We couldn't evaluate. Please try again.",
        explanation: null,
        error: true,
        result: 'unclear',
      }
    }

    const isCorrect =
      typeof parsed.isCorrect === 'boolean' ? parsed.isCorrect : null
    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.min(100, Math.max(0, parsed.confidence))
        : null
    const feedback =
      typeof parsed.feedback === 'string' && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : 'Nice effort! Thanks for sharing your thinking.'
    const explanation =
      typeof parsed.explanation === 'string' && parsed.explanation.trim()
        ? parsed.explanation.trim()
        : null

    let result = 'unclear'
    if (isCorrect === true) {
      result = 'correct'
      console.log('✅ Gemini: correct', confidence)
    } else if (isCorrect === false) {
      result = 'incorrect'
      console.log('⚠️ Gemini: incorrect', confidence)
    } else {
      console.log('⚠️ Gemini: unclear / null isCorrect')
    }

    return {
      isCorrect,
      confidence,
      feedback,
      explanation,
      error: false,
      result,
    }
  } catch (e) {
    console.log('❌ GeminiEvaluator failed:', e?.message || e)
    return {
      isCorrect: null,
      confidence: null,
      feedback: "We couldn't evaluate. Please try again.",
      explanation: null,
      error: true,
      result: 'unclear',
    }
  }
}

/**
 * Simple chat-style reply: sends "Respond to this: {text}" and returns plain text.
 * @param {string} text - User's transcribed speech (or any input)
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<{ response: string, error: boolean }>}
 */
export async function geminiRespondToText(text, apiKey) {
  const trimmed = (text || '').trim()
  if (!trimmed) {
    console.log('❌ geminiRespondToText: empty text')
    return { response: '', error: true }
  }
  if (!apiKey) {
    console.log('❌ geminiRespondToText: missing API key')
    return { response: '', error: true }
  }

  const prompt = `Respond to this: ${trimmed}`
  const url = `${geminiBaseUrl()}/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`

  console.log('💭 Gemini simple prompt request')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      console.log('❌ Gemini API error:', res.status, errText)
      return { response: '', error: true }
    }

    const data = await res.json()

    if (!data.candidates?.length) {
      console.log('❌ Gemini: no candidates', data?.error || data)
      return { response: '', error: true }
    }

    const rawText = data.candidates[0]?.content?.parts?.[0]?.text
    const response =
      typeof rawText === 'string' ? rawText.trim() : String(rawText || '').trim()

    if (data.error) {
      console.log('❌ Gemini response error field:', data.error)
      return { response: '', error: true }
    }

    if (!response) {
      console.log('⚠️ Gemini returned empty text')
      return { response: '', error: true }
    }

    console.log('✅ Gemini simple response ok')
    return { response, error: false }
  } catch (e) {
    console.log('❌ geminiRespondToText failed:', e?.message || e)
    return { response: '', error: true }
  }
}

const DEFAULT_TUTOR_SYSTEM_PROMPT = `You are a friendly tutor helping ADHD and ESL students.
Respond naturally and encouragingly in 2-3 sentences. Keep it simple and friendly.`

/**
 * Real-time voice conversation: tutor-style reply to what the student said.
 * @param {string} userMessage - Transcribed student speech
 * @param {string} [systemPrompt] - Optional instructions (defaults to friendly tutor)
 * @param {string} [apiKey] - Gemini API key (falls back to VITE_GEMINI_API_KEY)
 * @returns {Promise<{ response: string, error: boolean }>}
 */
export async function conversateWithGemini(userMessage, systemPrompt, apiKey) {
  const key =
    (typeof apiKey === 'string' && apiKey.trim()) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    ''

  const trimmed = (userMessage || '').trim()
  if (!trimmed) {
    console.log('❌ conversateWithGemini: empty user message')
    return { response: '', error: true }
  }
  if (!key) {
    console.log('❌ conversateWithGemini: missing API key')
    return { response: '', error: true }
  }

  const instructions =
    typeof systemPrompt === 'string' && systemPrompt.trim()
      ? systemPrompt.trim()
      : DEFAULT_TUTOR_SYSTEM_PROMPT

  const prompt = `${instructions}

The student said: ${trimmed}`

  const url = `${geminiBaseUrl()}/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`

  console.log('💭 Gemini conversation request')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 512,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      console.log('❌ Gemini API error:', res.status, errText)
      return { response: '', error: true }
    }

    const data = await res.json()

    if (!data.candidates?.length) {
      console.log('❌ Gemini: no candidates', data?.error || data)
      return { response: '', error: true }
    }

    const rawText = data.candidates[0]?.content?.parts?.[0]?.text
    const response =
      typeof rawText === 'string' ? rawText.trim() : String(rawText || '').trim()

    if (data.error) {
      console.log('❌ Gemini response error field:', data.error)
      return { response: '', error: true }
    }

    if (!response) {
      console.log('⚠️ Gemini returned empty text')
      return { response: '', error: true }
    }

    console.log('✅ Gemini conversation response ok')
    return { response, error: false }
  } catch (e) {
    console.log('❌ conversateWithGemini failed:', e?.message || e)
    return { response: '', error: true }
  }
}
