import { useCallback, useState } from 'react'

const SAMPLE =
  'Hello! This is a sample line from the Audio Ally engine. How does it sound?'

export default function AudioPlayer({ engine, elevenLabsApiKey }) {
  const [audioUrl, setAudioUrl] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const generate = useCallback(async () => {
    setError(null)
    setStatus('generating')
    try {
      const url = await engine.generateSpeech(SAMPLE, 'narrator')
      setAudioUrl(url)
      setStatus('ready')
    } catch (e) {
      setError(e?.message || String(e))
      setStatus('error')
    }
  }, [engine])

  const play = useCallback(async () => {
    if (!audioUrl) return
    setError(null)
    setStatus('playing')
    try {
      await engine.playAudio(audioUrl)
      setStatus('done')
    } catch (e) {
      setError(e?.message || String(e))
      setStatus('error')
    }
  }, [engine, audioUrl])

  const pause = useCallback(() => {
    engine.pauseAudio()
    setStatus('paused')
  }, [engine])

  const resume = useCallback(async () => {
    try {
      await engine.resumeAudio()
      setStatus('playing')
    } catch (e) {
      setError(e?.message || String(e))
    }
  }, [engine])

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl shadow-violet-950/40 backdrop-blur-sm">
      <h2 className="mb-2 text-xl font-semibold tracking-tight text-slate-100">
        Audio player
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-slate-400">
        ElevenLabs TTS via <code className="rounded bg-violet-950/80 px-1.5 py-0.5 text-violet-200">AudioEngine</code>
        — generate, then play, pause, or resume.
      </p>

      {!elevenLabsApiKey && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
          Set <code className="text-amber-200">VITE_ELEVENLABS_API_KEY</code> in{' '}
          <code className="text-amber-200">.env</code>.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={status === 'generating'}
          className="rounded-xl bg-violet-600 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'generating' ? 'Generating…' : 'Generate speech'}
        </button>
        <button
          type="button"
          onClick={play}
          disabled={!audioUrl || status === 'playing'}
          className="rounded-xl border border-violet-400/40 bg-slate-800 px-5 py-3 text-base font-semibold text-violet-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Play
        </button>
        <button
          type="button"
          onClick={pause}
          className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-base font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={resume}
          className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-base font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          Resume
        </button>
      </div>

      <p className="mt-5 text-sm text-slate-400">
        Status:{' '}
        <span className="font-medium text-violet-300">{status}</span>
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </section>
  )
}
