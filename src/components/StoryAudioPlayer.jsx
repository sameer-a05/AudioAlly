import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AudioEngine from '../services/AudioEngine'
import { SAMPLE_STORY } from '../data/sampleStory'

export default function StoryAudioPlayer({ elevenLabsApiKey, story }) {
  const engine = useMemo(
    () => new AudioEngine(elevenLabsApiKey || ''),
    [elevenLabsApiKey],
  )

  const [phase, setPhase] = useState('idle')
  const [lastQuestion, setLastQuestion] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    return () => engine.cleanup()
  }, [engine])

  const onQuestionDetected = useCallback(async (segment) => {
    setLastQuestion(segment)
    setPhase('question')
    await new Promise((r) => {
      window.setTimeout(r, 800)
    })
    setPhase('playing')
  }, [])

  const playStory = useCallback(async () => {
    setError(null)
    setLastQuestion(null)
    setPhase('playing')
    try {
      await engine.playStory(story || SAMPLE_STORY, onQuestionDetected)
      setPhase('done')
    } catch (e) {
      setError(e?.message || String(e))
      setPhase('error')
    }
  }, [engine, onQuestionDetected, story])

  const stop = useCallback(() => {
    try {
      engine.pauseAudio()
    } catch {
      /* ignore */
    }
    setPhase('idle')
  }, [engine])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-violet-500/30 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Story player
        </h1>
        <Link
          to="/"
          className="rounded-xl border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-950/60"
        >
          ← Home
        </Link>
      </div>

      <section className="rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl shadow-violet-950/40 backdrop-blur-sm">
        <h2 className="mb-2 text-xl font-semibold text-slate-100">Story audio</h2>
        <p className="mb-5 text-sm text-slate-400">
          {story ? (
            <>
              <span className="text-green-300">Generated story loaded!</span>
            </>
          ) : (
            <>
              Plays <code className="text-violet-300">SAMPLE_STORY</code> with narration and a question pause.
            </>
          )}
        </p>
        {story && (
          <div className="mb-6 p-4 bg-slate-800 rounded-xl text-slate-200">
            <h3 className="font-bold mb-2">Generated Story (JSON)</h3>
            <pre className="whitespace-pre-wrap text-xs max-h-96 overflow-auto">{JSON.stringify(story, null, 2)}</pre>
          </div>
        )}

        {!elevenLabsApiKey && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
            Add <code className="text-amber-200">VITE_ELEVENLABS_API_KEY</code> to your{' '}
            <code className="text-amber-200">.env</code> file.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={playStory}
            disabled={phase === 'playing'}
            className="rounded-xl bg-violet-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === 'playing' ? 'Playing…' : 'Play story'}
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-base font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Stop
          </button>
        </div>

        <p className="mt-5 text-sm text-slate-400">
          Phase: <span className="font-medium text-violet-300">{phase}</span>
        </p>

        {lastQuestion && (
          <div className="mt-5 rounded-xl border border-violet-500/30 bg-violet-950/30 p-4">
            <h3 className="mb-2 text-sm font-medium text-violet-200">Question</h3>
            <p className="text-slate-200">
              {lastQuestion.question_text || lastQuestion.text}
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </section>
    </div>
  )
}
