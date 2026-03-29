import { useCallback, useEffect, useRef, useState } from 'react'
import {
  VOICE_OPTIONS,
  isSpeechRecognitionSupported,
} from '../services/AudioEngine'
import { conversateWithGemini } from '../services/GeminiEvaluator'

const DEFAULT_VOICE = 'femaleNarrator'

/**
 * Speak → transcribe → Gemini (tutor) → ElevenLabs TTS → play audio.
 * Shows a scrollable chat thread (user right / assistant left).
 *
 * @param {import('../services/AudioEngine').default} props.engine
 * @param {string} [props.geminiApiKey]
 * @param {string} [props.elevenLabsApiKey]
 * @param {(userMessage: string, geminiResponse: string) => void} [props.onConversation]
 * @param {string} [props.systemPrompt] - Overrides default ADHD/ESL tutor instructions
 */
export default function VoiceConversation({
  engine,
  geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '',
  elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || '',
  onConversation,
  systemPrompt,
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [userMessage, setUserMessage] = useState('')
  const [geminiResponse, setGeminiResponse] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE)
  const [statusLine, setStatusLine] = useState('🎤 Click to speak')
  const [errorBanner, setErrorBanner] = useState(null)

  const scrollRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversationHistory, statusLine])

  const pushHistory = useCallback((entry) => {
    setConversationHistory((prev) => [...prev, entry])
  }, [])

  const runExchange = useCallback(async () => {
    if (!engine) return
    setErrorBanner(null)
    setStatusLine('📝 Converting to text…')

    try {
      const { transcript } = await engine.stopRecordingAndTranscribe()
      const text = (transcript || '').trim()
      console.log('📝 VoiceConversation transcript:', text)
      setUserMessage(text)

      if (!text) {
        setErrorBanner('Please try again — we did not hear anything.')
        setStatusLine('🎤 Click to speak')
        return
      }

      pushHistory({ role: 'user', message: text })
      setStatusLine('💭 Gemini is thinking…')

      const { response: reply, error: gemErr } = await conversateWithGemini(
        text,
        systemPrompt,
        geminiApiKey,
      )

      if (gemErr || !reply) {
        setErrorBanner("Couldn't get response, try again")
        setStatusLine('🎤 Click to speak')
        return
      }

      setGeminiResponse(reply)
      onConversation?.(text, reply)
      pushHistory({ role: 'assistant', message: reply })
      console.log('💭 Gemini reply:', reply.slice(0, 120))

      if (!elevenLabsApiKey) {
        setErrorBanner("Couldn't play response — add VITE_ELEVENLABS_API_KEY.")
        setStatusLine('🎤 Click to speak')
        return
      }

      setStatusLine('🔊 Playing response…')
      try {
        const url = await engine.generateSpeech(reply, selectedVoice)
        await engine.playAudio(url)
        console.log('🎉 VoiceConversation: playback finished')
      } catch (e) {
        console.log('❌ TTS/playback:', e)
        setErrorBanner("Couldn't play response")
      }

      setStatusLine('🎤 Click to speak')
    } catch (e) {
      console.log('❌ VoiceConversation:', e)
      setErrorBanner('Something went wrong. Please try again.')
      setStatusLine('🎤 Click to speak')
    } finally {
      setIsProcessing(false)
      setIsRecording(false)
    }
  }, [
    engine,
    geminiApiKey,
    elevenLabsApiKey,
    onConversation,
    pushHistory,
    selectedVoice,
    systemPrompt,
  ])

  const handleMicClick = useCallback(async () => {
    if (!engine) return
    if (isProcessing && !isRecording) return

    if (isRecording) {
      setIsRecording(false)
      setIsProcessing(true)
      await runExchange()
      return
    }

    setErrorBanner(null)
    setUserMessage('')
    setGeminiResponse('')

    if (!isSpeechRecognitionSupported()) {
      setErrorBanner(
        "Speech recognition isn't available in this browser. Try Chrome or Edge.",
      )
      return
    }

    try {
      setStatusLine('🎤 Recording…')
      await engine.startRecording({
        onRecognitionError: (ev) => {
          const code = ev?.error || ''
          if (code === 'not-allowed') {
            setErrorBanner('Microphone access denied')
            setIsRecording(false)
            setStatusLine('🎤 Click to speak')
            setIsProcessing(false)
          } else if (code === 'no-speech') {
            setErrorBanner('Please try again')
          }
          console.log('❌ VoiceConversation SR:', code)
        },
      })
      setIsRecording(true)
      console.log('🎤 VoiceConversation: recording')
    } catch (e) {
      console.log('❌ mic:', e)
      if (e?.name === 'NotAllowedError') {
        setErrorBanner('Microphone access denied')
      } else {
        setErrorBanner('Please try again')
      }
      setStatusLine('🎤 Click to speak')
      setIsProcessing(false)
      setIsRecording(false)
    }
  }, [engine, isProcessing, isRecording, runExchange])

  const micDisabled = isProcessing && !isRecording
  const showPulse = isRecording

  return (
    <section
      className="mx-auto flex max-w-2xl flex-col gap-5 rounded-2xl border border-violet-500/30 bg-slate-900/85 p-5 text-slate-100 shadow-xl"
      aria-label="Voice conversation with tutor"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-violet-100">
          Talk with your tutor
        </h2>
        <label className="flex flex-col gap-1 text-lg sm:min-w-[220px]">
          <span className="text-slate-400">Voice for replies</span>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={isProcessing}
            className="min-h-[48px] rounded-xl border border-violet-500/40 bg-slate-950 px-3 py-2 text-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {VOICE_OPTIONS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[min(420px,55vh)] min-h-[200px] overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-950/50 p-4"
        role="log"
        aria-live="polite"
      >
        {conversationHistory.length === 0 && (
          <p className="text-lg text-slate-500">
            Your conversation will appear here. Tap the microphone to start.
          </p>
        )}
        <ul className="flex flex-col gap-4">
          {conversationHistory.map((item, i) => (
            <li
              key={`${item.role}-${i}-${item.message.slice(0, 12)}`}
              className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-lg leading-relaxed shadow-md ${
                  item.role === 'user'
                    ? 'bg-sky-700/90 text-sky-50'
                    : 'bg-violet-900/90 text-violet-50'
                }`}
              >
                {item.role === 'user' ? (
                  <>
                    <span className="font-semibold">You said: </span>
                    {item.message}
                  </>
                ) : (
                  item.message
                )}
              </div>
            </li>
          ))}
        </ul>
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => void handleMicClick()}
          disabled={micDisabled || !engine}
          aria-pressed={isRecording}
          className={`relative flex min-h-[64px] min-w-[64px] items-center justify-center rounded-full border-4 px-8 py-6 text-xl font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
            showPulse
              ? 'animate-pulse border-fuchsia-400 bg-gradient-to-br from-violet-600 to-fuchsia-600 [animation-duration:2.2s]'
              : 'border-violet-400 bg-gradient-to-br from-violet-600 to-indigo-700'
          }`}
        >
          {isRecording ? '⏹️ Tap when done' : '🎤 Speak to me'}
        </button>

        <p
          className="min-h-[1.75rem] text-center text-lg text-slate-300"
          aria-live="assertive"
        >
          {statusLine}
        </p>
      </div>

      {(userMessage || geminiResponse) && (
        <div className="sr-only" aria-live="polite">
          {userMessage && <span>You said: {userMessage}. </span>}
          {geminiResponse && <span>Tutor: {geminiResponse}</span>}
        </div>
      )}

      {errorBanner && (
        <p
          className="rounded-xl border border-amber-600/50 bg-amber-950/50 px-4 py-3 text-lg text-amber-100"
          role="alert"
        >
          {errorBanner}
        </p>
      )}

      {!geminiApiKey && (
        <p className="text-center text-lg text-amber-200/90">
          Set <code className="text-violet-300">VITE_GEMINI_API_KEY</code> in{' '}
          <code className="text-violet-300">.env</code>.
        </p>
      )}
    </section>
  )
}
