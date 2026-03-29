import { useCallback, useState } from 'react'
import { VOICE_OPTIONS } from '../services/AudioEngine'
import { useVoice } from '../context/VoiceContext'

const SAMPLE_SENTENCE =
  'Hello, this is a sample of my voice. How do you like it?'

function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={`animate-spin text-violet-300 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

/**
 * Voice grid with preview samples, custom text preview, and confirm.
 */
export default function VoiceSelector({ engine, elevenLabsApiKey }) {
  const { selectedVoice, setSelectedVoice, confirmSelection, appliedVoice } =
    useVoice()

  const [previewLoadingKey, setPreviewLoadingKey] = useState(null)
  const [playingKey, setPlayingKey] = useState(null)
  const [customText, setCustomText] = useState(
    'Try typing your own sentence here.',
  )
  const [customLoading, setCustomLoading] = useState(false)
  const [customPlaying, setCustomPlaying] = useState(false)
  const [error, setError] = useState(null)

  const labelFor = useCallback(
    (key) => VOICE_OPTIONS.find((v) => v.key === key)?.label ?? key,
    [],
  )

  const playSampleForVoice = useCallback(
    async (voiceKey) => {
      if (!elevenLabsApiKey) {
        setError('Add VITE_ELEVENLABS_API_KEY to use previews.')
        return
      }
      setError(null)
      engine.pauseAudio()
      setPreviewLoadingKey(voiceKey)
      setPlayingKey(null)
      console.log('🔊 Preview sample:', voiceKey)
      try {
        const url = await engine.generateSpeech(SAMPLE_SENTENCE, voiceKey)
        setPreviewLoadingKey(null)
        setPlayingKey(voiceKey)
        console.log('▶️ Playing sample for', voiceKey)
        await engine.playAudio(url)
      } catch (e) {
        console.log('❌ Preview failed:', e)
        setError(e?.message || String(e))
      } finally {
        setPlayingKey(null)
        setPreviewLoadingKey(null)
      }
    },
    [engine, elevenLabsApiKey],
  )

  const playCustomText = useCallback(async () => {
    const trimmed = customText.trim()
    if (!trimmed) {
      setError('Type some text to preview.')
      return
    }
    if (!elevenLabsApiKey) {
      setError('Add VITE_ELEVENLABS_API_KEY to use previews.')
      return
    }
    setError(null)
    engine.pauseAudio()
    setCustomLoading(true)
    setCustomPlaying(false)
    console.log('🔊 Custom preview, voice:', selectedVoice)
    try {
      const url = await engine.generateSpeech(trimmed, selectedVoice)
      setCustomLoading(false)
      setCustomPlaying(true)
      await engine.playAudio(url)
    } catch (e) {
      console.log('❌ Custom preview failed:', e)
      setError(e?.message || String(e))
    } finally {
      setCustomPlaying(false)
      setCustomLoading(false)
    }
  }, [engine, elevenLabsApiKey, customText, selectedVoice])

  const appliedLabel = labelFor(appliedVoice)

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl shadow-violet-950/40 backdrop-blur-sm">
      <h2 className="mb-2 text-xl font-semibold tracking-tight text-slate-100">
        Voice
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Pick a voice for narration and previews. Hover a card to preview the
        sample line, or use Play sample on touch screens.
      </p>

      <div className="mb-6 rounded-xl border border-violet-500/40 bg-violet-950/40 px-4 py-3 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-violet-300/80">
          Active voice (used for story &amp; audio player)
        </p>
        <p className="text-lg font-semibold text-violet-100">{appliedLabel}</p>
      </div>

      {!elevenLabsApiKey && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
          Set <code className="text-amber-200">VITE_ELEVENLABS_API_KEY</code> in{' '}
          <code className="text-amber-200">.env</code> to generate previews.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {VOICE_OPTIONS.map(({ key, label }) => {
          const isSelected = selectedVoice === key
          const loading = previewLoadingKey === key
          const playing = playingKey === key

          return (
            <div
              key={key}
              className={`group relative flex min-h-[52px] flex-col rounded-xl border-2 transition ${
                isSelected
                  ? 'border-violet-400 bg-violet-950/50 shadow-lg shadow-violet-900/30'
                  : 'border-slate-700 bg-slate-900/60 hover:border-violet-500/40'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedVoice(key)
                  console.log('✅ Voice selected:', key)
                }}
                className="flex min-h-[48px] flex-1 items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="font-medium text-slate-100">{label}</span>
                {isSelected && (
                  <span className="text-lg text-violet-300" aria-hidden>
                    ✓
                  </span>
                )}
              </button>

              <div className="border-t border-slate-700/80 px-2 pb-2 pt-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void playSampleForVoice(key)
                  }}
                  disabled={!!previewLoadingKey || customLoading}
                  className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-violet-600/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Generating…
                    </>
                  ) : playing ? (
                    <>
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
                      Playing…
                    </>
                  ) : (
                    'Play sample'
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-5 text-xs text-slate-500 lg:hidden">
        Tip: On desktop, hover a voice card to preview without selecting.
      </p>

      <div className="mt-8 border-t border-violet-500/20 pt-6">
        <h3 className="mb-2 text-sm font-semibold text-violet-200">
          Preview with your own text
        </h3>
        <p className="mb-5 text-sm text-slate-400">
          Uses the voice you have selected above (highlighted with ✓).
        </p>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          rows={3}
          className="mb-3 w-full resize-y rounded-xl border border-slate-600 bg-slate-950/80 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          placeholder="Type anything to hear it in the selected voice…"
        />
        <button
          type="button"
          onClick={() => void playCustomText()}
          disabled={customLoading || !!previewLoadingKey}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-950/40 transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {customLoading ? (
            <>
              <Spinner className="h-5 w-5" />
              Generating…
            </>
          ) : customPlaying ? (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
              Playing…
            </>
          ) : (
            'Preview with custom text'
          )}
        </button>
      </div>

      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Selected:{' '}
          <span className="font-medium text-violet-200">
            {labelFor(selectedVoice)}
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            confirmSelection()
            console.log('✅ Voice confirmed:', selectedVoice)
          }}
          className="min-h-[44px] rounded-xl bg-violet-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500"
        >
          Confirm selection
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
