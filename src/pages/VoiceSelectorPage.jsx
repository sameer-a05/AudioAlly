import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AudioEngine, { VOICE_OPTIONS } from '../services/AudioEngine'
import { useVoice } from '../context/VoiceContext'
import Navigation from '../components/Navigation'
import { VoiceCharacterArt } from '../components/voice/VoiceCharacterArt'
import { IconCheckCircle, IconPause, IconPlay } from '../components/icons/BrandIcons'

const ELEVEN_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || ''

const VOICE_META = {
  femaleNarrator: {
    gradient: 'linear-gradient(165deg, #db2777 0%, #f472b6 45%, #fce7f3 100%)',
    blurb: 'Kind and clear—like a favorite teacher.',
  },
  maleNarrator: {
    gradient: 'linear-gradient(165deg, #0891b2 0%, #22d3ee 50%, #cffafe 100%)',
    blurb: 'Friendly mentor energy—steady and supportive.',
  },
  sheriffBilly: {
    gradient: 'linear-gradient(165deg, #78350f 0%, #d97706 55%, #fde68a 100%)',
    blurb: 'Warm, playful, and a little bit cowboy.',
  },
  stadiumStan: {
    gradient: 'linear-gradient(165deg, #1e40af 0%, #06b6d4 50%, #bae6fd 100%)',
    blurb: 'High-energy hype that keeps you moving.',
  },
  commanderConner: {
    gradient: 'linear-gradient(165deg, #4c1d95 0%, #7c3aed 45%, #ddd6fe 100%)',
    blurb: 'Bold and adventurous—mission-ready.',
  },
  studioStacey: {
    gradient: 'linear-gradient(165deg, #ea580c 0%, #fb923c 55%, #ffedd5 100%)',
    blurb: 'Creative sparkle with studio polish.',
  },
}

export default function VoiceSelectorPage() {
  const navigate = useNavigate()
  const engine = useMemo(() => new AudioEngine(ELEVEN_KEY), [])
  const { selectedVoice, setSelectedVoice, confirmSelection } = useVoice()

  const [previewLoadingKey, setPreviewLoadingKey] = useState(null)
  const [playingKey, setPlayingKey] = useState(null)
  const [error, setError] = useState(null)

  const labelFor = useCallback(
    (key) => VOICE_OPTIONS.find((v) => v.key === key)?.label ?? key,
    [],
  )

  const playSample = useCallback(
    async (voiceKey) => {
      if (!ELEVEN_KEY) {
        setError('Add VITE_ELEVENLABS_API_KEY to use voice previews.')
        return
      }
      setError(null)
      engine.pauseAudio()
      const name = labelFor(voiceKey)
      const sentence = `Hello, this is ${name} speaking.`
      setPreviewLoadingKey(voiceKey)
      setPlayingKey(null)
      try {
        const url = await engine.generateSpeech(sentence, voiceKey)
        setPreviewLoadingKey(null)
        setPlayingKey(voiceKey)
        await engine.playAudio(url)
      } catch (e) {
        setError(e?.message || String(e))
      } finally {
        setPlayingKey(null)
        setPreviewLoadingKey(null)
      }
    },
    [engine, labelFor],
  )

  const handleChoose = useCallback(
    (key) => {
      setSelectedVoice(key)
      confirmSelection(key)
    },
    [setSelectedVoice, confirmSelection],
  )

  return (
    <div className="aa-page aa-page-enter">
      <Navigation />
      <div className="aa-container" style={{ paddingTop: 28, paddingBottom: 72 }}>
        <div style={{ marginBottom: 28 }}>
          <Link to="/" className="aa-back">
            Back
          </Link>
          <h1 className="aa-display" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginTop: 20 }}>
            Pick your narrator 🎙️
          </h1>
          <p className="aa-body-text" style={{ maxWidth: 560, marginTop: 10 }}>
            Who&apos;ll be your guide? Tap listen to preview—then choose your favorite.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 28,
          }}
        >
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              style={{
                width: s === 1 ? 28 : 10,
                height: 10,
                borderRadius: 999,
                background: s === 1 ? 'var(--aa-primary)' : 'var(--aa-border)',
              }}
            />
          ))}
          <span className="aa-small" style={{ marginLeft: 12 }}>
            Step 1 of 3
          </span>
        </div>

        {selectedVoice && (
          <div
            className="aa-card"
            style={{
              marginBottom: 28,
              borderRadius: 20,
              borderColor: 'rgba(124, 58, 237, 0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <IconCheckCircle style={{ color: 'var(--aa-success)', flexShrink: 0, width: 32, height: 32 }} />
            <div>
              <p className="aa-small" style={{ marginBottom: 4 }}>
                Narrator locked in
              </p>
              <p className="aa-subhead" style={{ margin: 0, fontSize: '1.2rem' }}>
                {labelFor(selectedVoice)}
              </p>
            </div>
          </div>
        )}

        {!ELEVEN_KEY && (
          <p className="aa-small" style={{ color: 'var(--aa-warning)', marginBottom: 16 }}>
            Add <code>VITE_ELEVENLABS_API_KEY</code> to preview voices.
          </p>
        )}
        {error && (
          <p className="aa-small" style={{ color: 'var(--aa-error)', marginBottom: 16 }} role="alert">
            {error}
          </p>
        )}

        <div className="aa-voice-grid">
          {VOICE_OPTIONS.map(({ key, label }) => {
            const selected = selectedVoice === key
            const loading = previewLoadingKey === key
            const playing = playingKey === key
            const meta = VOICE_META[key] || VOICE_META.femaleNarrator
            return (
              <div
                key={key}
                className={`aa-voice-card-kid ${selected ? 'aa-card--selected' : ''}`}
                style={{
                  background: 'var(--aa-card)',
                  boxShadow: selected ? 'var(--aa-shadow-glow)' : 'var(--aa-shadow)',
                }}
              >
                <div
                  style={{
                    background: meta.gradient,
                    padding: '12px 12px 0',
                    minHeight: 150,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.9)',
                      background: selected ? '#fff' : 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected && <span style={{ color: '#7c3aed', fontSize: 14, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ height: 130, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <VoiceCharacterArt voiceKey={key} style={{ maxHeight: 130 }} />
                  </div>
                </div>
                <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 className="aa-card-title" style={{ fontSize: '1.05rem', marginBottom: 6 }}>
                    {label}
                  </h3>
                  <p className="aa-small" style={{ flex: 1, marginBottom: 14, color: 'var(--aa-text-secondary)' }}>
                    {meta.blurb}
                  </p>
                  {playing && (
                    <div className="aa-mini-spectrum" style={{ marginBottom: 10 }} aria-hidden>
                      <span style={{ height: 12 }} />
                      <span style={{ height: 18 }} />
                      <span style={{ height: 24 }} />
                      <span style={{ height: 14 }} />
                      <span style={{ height: 20 }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      type="button"
                      className="aa-btn aa-btn-secondary aa-btn-block"
                      disabled={loading || !!playingKey}
                      onClick={() => void playSample(key)}
                    >
                      {loading ? (
                        <span className="aa-loading-dots" aria-hidden>
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : playing ? (
                        <>
                          <IconPause />
                          Playing…
                        </>
                      ) : (
                        <>
                          <IconPlay />
                          Listen
                        </>
                      )}
                    </button>
                    <button type="button" className="aa-btn aa-btn-primary aa-btn-block" onClick={() => handleChoose(key)}>
                      {selected ? 'Selected' : 'Choose'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 44, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
          <button type="button" className="aa-btn aa-btn-primary aa-btn-block aa-btn-xl" onClick={() => navigate('/learn')}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
