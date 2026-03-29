import { useCallback, useEffect, useRef, useState } from 'react'
import AudioEngine from '../services/AudioEngine'

const INITIAL_SILENCE_MS = 5000

function isMicAccessDenied(err) {
  const name = err?.name || ''
  const msg = String(err?.message || '')
  return (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    /denied|not allowed|Permission/i.test(msg)
  )
}

/** Map Web Speech API `error` codes to user-facing copy */
function mapRecognitionError(ev) {
  const code = ev?.error || ''
  switch (code) {
    case 'no-speech':
      return 'No speech detected. Please try again and speak clearly.'
    case 'network':
      return 'Network error. Check your internet connection.'
    case 'not-allowed':
      return 'Microphone permission denied.'
    default:
      return 'Could not understand. Please try again.'
  }
}

function playStartBeep() {
  return new Promise((resolve) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.value = 0.08
      osc.start()
      window.setTimeout(() => {
        try {
          osc.stop()
          ctx.close()
        } catch {
          /* ignore */
        }
        resolve()
      }, 140)
    } catch {
      resolve()
    }
  })
}

export default function MicrophoneRecorder() {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || ''
  const engineRef = useRef(null)

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine(apiKey || '')
      console.log('🎤 AudioEngine ready. API key length:', apiKey.length)
    }
    return engineRef.current
  }, [apiKey])

  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [srNotice, setSrNotice] = useState(null)
  const [partialText, setPartialText] = useState('')
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [heardSpeech, setHeardSpeech] = useState(false)

  const speechDetectedRef = useRef(false)
  const silenceTimerRef = useRef(null)
  const isRecordingRef = useRef(false)

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const stop = useCallback(async () => {
    console.log('🎤 Stop recording requested')
    clearSilenceTimer()
    isRecordingRef.current = false
    setVolumeLevel(0)
    setPartialText('')

    try {
      const engine = getEngine()
      const { transcript: text } = await engine.stopRecordingAndTranscribe()
      const trimmed = (text || '').trim()
      console.log('🎤 Raw transcript:', text)

      setIsRecording(false)

      if (!trimmed) {
        console.log('❌ Empty transcript')
        setTranscript('')
        setError('No speech detected. Please try again and speak clearly.')
        return
      }

      console.log('✅ Transcript captured:', trimmed)
      setTranscript(trimmed)
      setError(null)
      setSrNotice(null)
    } catch (e) {
      console.log('❌ stopRecordingAndTranscribe failed:', e?.message || e)
      setIsRecording(false)
      if (isMicAccessDenied(e)) {
        setError('Microphone access denied')
      } else {
        setError(e?.message || String(e))
      }
    }
  }, [getEngine, clearSilenceTimer])

  const stopRef = useRef(stop)
  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  const scheduleInitialSilenceWatch = useCallback(() => {
    clearSilenceTimer()
    speechDetectedRef.current = false
    setHeardSpeech(false)
    silenceTimerRef.current = window.setTimeout(async () => {
      if (!isRecordingRef.current || speechDetectedRef.current) return
      console.log('❌ No speech within 5s. Auto-stopping')
      setError('No speech detected. Please try again and speak clearly.')
      await stopRef.current()
    }, INITIAL_SILENCE_MS)
  }, [clearSilenceTimer])

  const start = useCallback(async () => {
    setError(null)
    setSrNotice(null)
    setTranscript('')
    setPartialText('')
    speechDetectedRef.current = false
    setHeardSpeech(false)
    console.log('🎤 Start recording requested')

    try {
      const engine = getEngine()

      await engine.startRecording({
        onVolumeLevel: (level) => {
          if (isRecordingRef.current) setVolumeLevel(level)
        },
        onSpeechActivity: () => {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true
            setHeardSpeech(true)
            clearSilenceTimer()
            console.log('✅ Speech activity. Silence timer cleared (keep listening for full sentences)')
          }
        },
        onPartialTranscript: (combined) => {
          setPartialText(combined)
        },
        onRecognitionError: (ev) => {
          const msg = mapRecognitionError(ev)
          console.log('❌ Speech recognition:', ev?.error, msg)
          setSrNotice(msg)
          if (ev?.error === 'not-allowed') {
            void stopRef.current()
          }
        },
      })

      isRecordingRef.current = true
      setIsRecording(true)
      setVolumeLevel(0)

      await playStartBeep()
      console.log('✅ Beep played. User can speak')

      scheduleInitialSilenceWatch()
    } catch (e) {
      console.log('❌ startRecording failed:', e?.name, e?.message || e)
      isRecordingRef.current = false
      setIsRecording(false)
      if (isMicAccessDenied(e)) {
        setError('Microphone permission denied.')
      } else {
        setError(e?.message || String(e))
      }
    }
  }, [getEngine, scheduleInitialSilenceWatch, clearSilenceTimer])

  useEffect(
    () => () => {
      clearSilenceTimer()
    },
    [clearSilenceTimer],
  )

  const tryAgain = useCallback(async () => {
    setTranscript('')
    setError(null)
    setSrNotice(null)
    setPartialText('')
    console.log('🎤 Try again. Restarting')
    await start()
  }, [start])

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl shadow-violet-950/40 backdrop-blur-sm">
      <h2 className="mb-2 text-xl font-semibold tracking-tight text-slate-100">
        Microphone
      </h2>

      <p className="mb-3 text-sm leading-relaxed text-slate-400">
        Record with the mic and transcribe using the Web Speech API (free, in-browser).
      </p>
      <p className="mb-5 rounded-lg border border-violet-500/20 bg-violet-950/30 px-3 py-2 text-sm text-violet-200/95">
        Speak clearly and wait for the beep to stop recording.
      </p>

      <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        {!isRecording ? (
          <button
            type="button"
            onClick={start}
            className="rounded-xl bg-violet-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500"
          >
            Start recording
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void stop()}
              className="rounded-xl border-2 border-violet-400/60 bg-violet-950/50 px-6 py-3.5 text-lg font-semibold text-violet-100 transition hover:bg-violet-900/60"
            >
              Stop Recording
            </button>

            <div className="flex items-center gap-4">
              <div
                className="relative flex h-16 w-16 items-center justify-center"
                aria-hidden
              >
                <span className="absolute h-14 w-14 animate-ping rounded-full bg-violet-500/40" />
                <span className="absolute h-12 w-12 animate-pulse rounded-full bg-violet-500/70" />
                <span className="relative h-8 w-8 rounded-full bg-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.8)]" />
              </div>
              <div>
                <p className="text-base font-semibold text-violet-200">Listening…</p>
                <p className="text-sm text-slate-400">Recording… tap Stop when you&apos;re done</p>
              </div>
            </div>
          </>
        )}
      </div>

      {isRecording && (
        <div className="mb-6 space-y-2">
          <div className="flex h-3 w-full max-w-md overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-[width] duration-75"
              style={{ width: `${volumeLevel}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Input level: {volumeLevel}%
            {!heardSpeech && (
              <span className="text-violet-400">. Speak within 5 seconds or we&apos;ll stop</span>
            )}
          </p>
        </div>
      )}

      {isRecording && partialText && (
        <p className="mb-4 text-sm italic text-slate-400">
          Live: <span className="text-slate-300">{partialText}</span>
        </p>
      )}

      {srNotice && (
        <p className="mb-3 rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          {srNotice}
        </p>
      )}

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {(transcript || error) && !isRecording && (
        <button
          type="button"
          onClick={() => void tryAgain()}
          className="mb-6 rounded-xl border border-violet-400/50 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-slate-700"
        >
          Try again
        </button>
      )}

      {transcript && !error && (
        <div className="rounded-2xl border-2 border-violet-500/35 bg-slate-950/80 p-6 shadow-inner">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-400/90">
            What we understood
          </h3>
          <p className="text-xl leading-relaxed text-slate-100 md:text-2xl md:leading-snug">
            {transcript}
          </p>
        </div>
      )}
    </section>
  )
}
