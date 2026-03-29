import { useCallback, useState } from 'react'
import { isSpeechRecognitionSupported } from '../services/AudioEngine'
import { geminiRespondToText } from '../services/GeminiEvaluator'

/**
 * Record speech → Web Speech transcript → Gemini ("Respond to this: …").
 *
 * @param {import('../services/AudioEngine').default} props.engine - Shared AudioEngine instance
 * @param {string} [props.geminiApiKey] - Defaults to import.meta.env.VITE_GEMINI_API_KEY
 * @param {(response: string) => void} [props.onResponse] - Fired when Gemini returns text successfully
 */
export default function SimpleSpeechInput({
  engine,
  geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '',
  onResponse,
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [geminiResponse, setGeminiResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorBanner, setErrorBanner] = useState(null)

  const finishRecording = useCallback(async () => {
    if (!engine) return
    setIsRecording(false)
    setIsLoading(true)
    setErrorBanner(null)
    setGeminiResponse('')

    try {
      const { transcript: raw } = await engine.stopRecordingAndTranscribe()
      const text = (raw || '').trim()
      console.log('📝 SimpleSpeechInput transcript:', text)
      setTranscript(text)

      if (!text) {
        setErrorBanner(
          "We didn't catch anything. Try again and speak a bit longer.",
        )
        setIsLoading(false)
        return
      }

      const { response, error } = await geminiRespondToText(text, geminiApiKey)
      if (error || !response) {
        setErrorBanner(
          "We couldn't get a reply from Gemini. Check your key and connection.",
        )
        setIsLoading(false)
        return
      }

      setGeminiResponse(response)
      onResponse?.(response)
      console.log('🎉 SimpleSpeechInput: Gemini reply shown')
    } catch (e) {
      console.log('❌ SimpleSpeechInput:', e)
      setErrorBanner('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [engine, geminiApiKey, onResponse])

  const startRecording = useCallback(async () => {
    if (!engine) {
      setErrorBanner('Audio engine is not ready.')
      return
    }
    setErrorBanner(null)
    setTranscript('')
    setGeminiResponse('')

    if (!isSpeechRecognitionSupported()) {
      setErrorBanner(
        "This browser doesn't support speech recognition. Try Chrome or Edge.",
      )
      return
    }

    try {
      await engine.startRecording({
        onRecognitionError: (ev) => {
          const code = ev?.error || ''
          if (code === 'not-allowed') {
            setErrorBanner(
              'Microphone access was blocked. Allow the mic in browser settings.',
            )
            setIsRecording(false)
          } else if (code === 'network') {
            setErrorBanner('Network error with speech recognition. Try again.')
          }
          console.log('❌ SimpleSpeechInput SR:', code)
        },
      })
      setIsRecording(true)
      console.log('🎤 SimpleSpeechInput: recording started')
    } catch (e) {
      console.log('❌ SimpleSpeechInput start:', e)
      setErrorBanner(
        e?.name === 'NotAllowedError'
          ? 'We need microphone permission to hear you.'
          : "Couldn't start the microphone. Please try again.",
      )
      setIsRecording(false)
    }
  }, [engine])

  const handleMicClick = useCallback(() => {
    if (isLoading) return
    if (isRecording) {
      void finishRecording()
    } else {
      void startRecording()
    }
  }, [isLoading, isRecording, finishRecording, startRecording])

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 rounded-2xl border border-violet-500/40 bg-slate-900/80 p-6 text-slate-100 shadow-lg shadow-violet-950/50">
      <h2 className="text-center text-2xl font-bold tracking-tight text-violet-200">
        Speak, then get a reply
      </h2>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={handleMicClick}
          disabled={isLoading || !engine}
          aria-pressed={isRecording}
          className="flex h-[72px] min-h-[60px] w-[72px] min-w-[60px] items-center justify-center rounded-full border-4 border-violet-400 bg-gradient-to-br from-violet-600 to-fuchsia-700 text-4xl shadow-lg shadow-violet-900/60 transition hover:scale-[1.03] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRecording ? '⏹️' : '🎤'}
        </button>

        <p className="min-h-[1.75rem] text-center text-lg text-violet-200">
          {isLoading
            ? 'Working on it…'
            : isRecording
              ? 'Recording… tap the button again when you’re done.'
              : 'Tap the mic to start recording.'}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 text-lg text-violet-200">
          <span
            className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent"
            aria-hidden
          />
          Sending to Gemini…
        </div>
      )}

      {errorBanner && (
        <p
          className="rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-lg text-amber-100"
          role="alert"
        >
          {errorBanner}
        </p>
      )}

      {transcript && !isRecording && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-4 py-4">
          <p className="text-xl leading-relaxed text-slate-100">
            <span className="font-semibold text-violet-300">You said: </span>
            {transcript}
          </p>
        </div>
      )}

      {geminiResponse && (
        <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/25 px-4 py-4">
          <p className="text-lg font-semibold text-fuchsia-200">Gemini says</p>
          <p className="mt-2 whitespace-pre-wrap text-xl leading-relaxed text-slate-50">
            {geminiResponse}
          </p>
        </div>
      )}

      {!geminiApiKey && (
        <p className="text-center text-lg text-amber-200/90">
          Set <code className="text-violet-300">VITE_GEMINI_API_KEY</code> in{' '}
          <code className="text-violet-300">.env</code> for replies.
        </p>
      )}
    </div>
  )
}
