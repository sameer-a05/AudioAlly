import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AudioEngine, {
  isSpeechRecognitionSupported,
  VOICE_OPTIONS,
} from '../services/AudioEngine'
import { evaluateAnswer } from '../services/GeminiEvaluator'
import { generateStoryFromPDF } from '../services/GeminiStoryGenerator'
import { useVoice } from '../context/VoiceContext'
import MascotCharacter from './MascotCharacter'
import { IconMic, IconSettings, IconStop } from './icons/BrandIcons'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const ELEVEN_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || ''

export default function PDFLearningFlow() {
  const navigate = useNavigate()
  const { appliedVoice, setSelectedVoice: setContextVoice } = useVoice()
  const engine = useMemo(() => new AudioEngine(ELEVEN_KEY), [])

  useEffect(() => () => engine.cleanup(), [engine])

  const [step, setStep] = useState(1)
  const [selectedVoice, setSelectedVoice] = useState(appliedVoice)
  const [age, setAge] = useState(10)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [questions, setQuestions] = useState([])

  const [qIndex, setQIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [evalLoading, setEvalLoading] = useState(false)
  const [evalResult, setEvalResult] = useState(null)

  const [, setRounds] = useState([])

  const [ttsBusy, setTtsBusy] = useState(false)
  const [allowAnswer, setAllowAnswer] = useState(false)
  const [feedbackPlaying, setFeedbackPlaying] = useState(false)

  const storyIntroDoneRef = useRef(false)

  const currentQ = questions[qIndex]
  const nQuestions = questions.length || 2

  useEffect(() => {
    setSelectedVoice(appliedVoice)
  }, [appliedVoice])

  const selectedVoiceLabel = useMemo(
    () =>
      VOICE_OPTIONS.find((o) => o.key === selectedVoice)?.label ?? selectedVoice,
    [selectedVoice],
  )

  const onVoiceSelectChange = useCallback(
    (key) => {
      setSelectedVoice(key)
      setContextVoice(key)
    },
    [setContextVoice],
  )

  useEffect(() => {
    if (step !== 2 || !questions.length) return
    const q = questions[qIndex]
    if (!q) return
    const qText = q.question_text || q.question
    let cancelled = false

    async function run() {
      if (!ELEVEN_KEY) {
        setAllowAnswer(true)
        setTtsBusy(false)
        return
      }

      setAllowAnswer(false)
      setTtsBusy(true)
      try {
        if (qIndex === 0 && story && !storyIntroDoneRef.current) {
          const urlStory = await engine.generateSpeech(story, selectedVoice)
          if (cancelled) return
          await engine.playAudio(urlStory)
          storyIntroDoneRef.current = true
        }
        if (cancelled) return
        const urlQ = await engine.generateSpeech(qText, selectedVoice)
        if (cancelled) return
        await engine.playAudio(urlQ)
      } catch (e) {
        console.log('❌ TTS:', e)
      } finally {
        if (!cancelled) {
          setTtsBusy(false)
          setAllowAnswer(true)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      engine.pauseAudio()
    }
  }, [step, qIndex, questions, story, engine, selectedVoice])

  useEffect(() => {
    if (!evalResult || !ELEVEN_KEY) {
      if (!evalResult) setFeedbackPlaying(false)
      return
    }

    let cancelled = false
    const text =
      evalResult.isCorrect === true
        ? 'Great job! You got it right!'
        : (evalResult.feedback || 'Nice try. Keep going!')

    async function playFeedback() {
      setFeedbackPlaying(true)
      setAllowAnswer(false)
      try {
        const url = await engine.generateSpeech(text, selectedVoice)
        if (cancelled) return
        await engine.playAudio(url)
      } catch (e) {
        console.log('❌ Feedback TTS:', e)
      } finally {
        if (!cancelled) {
          setFeedbackPlaying(false)
          setAllowAnswer(true)
        }
      }
    }

    void playFeedback()
    return () => {
      cancelled = true
      engine.pauseAudio()
    }
  }, [evalResult, engine, selectedVoice])

  const handleGenerate = useCallback(async () => {
    if (!file) {
      setLoadError('Choose a PDF first.')
      return
    }
    setLoadError(null)
    setLoading(true)
    try {
      const data = await generateStoryFromPDF(file, age, GEMINI_KEY)
      storyIntroDoneRef.current = false
      setTitle(data.title || 'Story')
      setStory(data.story_text || data.story)
      setQuestions(data.questions)
      setStep(2)
      setQIndex(0)
      setTranscript('')
      setEvalResult(null)
      setRounds([])
    } catch (e) {
      setLoadError(e?.message || 'Generation failed.')
    } finally {
      setLoading(false)
    }
  }, [file, age])

  const readStoryAloud = useCallback(async () => {
    if (!story || !ELEVEN_KEY) return
    setTtsBusy(true)
    setAllowAnswer(false)
    try {
      const url = await engine.generateSpeech(story, selectedVoice)
      await engine.playAudio(url)
    } catch (e) {
      console.log('❌ Read story TTS:', e)
    } finally {
      setTtsBusy(false)
      setAllowAnswer(true)
    }
  }, [engine, story, selectedVoice])

  const readQuestionAgain = useCallback(async () => {
    if (!currentQ || !ELEVEN_KEY) return
    const qText = currentQ.question_text || currentQ.question
    setTtsBusy(true)
    setAllowAnswer(false)
    try {
      const url = await engine.generateSpeech(qText, selectedVoice)
      await engine.playAudio(url)
    } catch (e) {
      console.log('❌ Read question TTS:', e)
    } finally {
      setTtsBusy(false)
      setAllowAnswer(true)
    }
  }, [engine, currentQ, selectedVoice])

  const hearFeedbackAgain = useCallback(async () => {
    if (!evalResult || !ELEVEN_KEY) return
    const text =
      evalResult.isCorrect === true
        ? 'Great job! You got it right!'
        : (evalResult.feedback || 'Nice try. Keep going!')
    setFeedbackPlaying(true)
    setAllowAnswer(false)
    try {
      const url = await engine.generateSpeech(text, selectedVoice)
      await engine.playAudio(url)
    } catch (e) {
      console.log('❌ Feedback replay:', e)
    } finally {
      setFeedbackPlaying(false)
      setAllowAnswer(true)
    }
  }, [engine, evalResult, selectedVoice])

  const startMic = useCallback(async () => {
    setLoadError(null)
    setEvalResult(null)
    if (!isSpeechRecognitionSupported()) {
      setLoadError('Speech recognition not supported in this browser.')
      return
    }
    if (!allowAnswer || ttsBusy || feedbackPlaying) return
    try {
      await engine.startRecording({
        onPartialTranscript: (t) => setTranscript(t),
        onRecognitionError: (ev) => {
          if (ev?.error === 'not-allowed') {
            setLoadError('Microphone access denied.')
            setIsRecording(false)
          }
        },
      })
      setIsRecording(true)
      setTranscript('')
    } catch (e) {
      setLoadError(
        e?.name === 'NotAllowedError'
          ? 'Microphone access denied.'
          : 'Could not start mic.',
      )
      setIsRecording(false)
    }
  }, [engine, allowAnswer, ttsBusy, feedbackPlaying])

  const stopMic = useCallback(async () => {
    setIsRecording(false)
    try {
      const { transcript: t } = await engine.stopRecordingAndTranscribe()
      setTranscript((t || '').trim())
    } catch {
      setTranscript('')
    }
  }, [engine])

  const handleEvaluate = useCallback(async () => {
    if (!currentQ || !transcript.trim()) {
      setLoadError('Record an answer first.')
      return
    }
    setEvalLoading(true)
    setLoadError(null)
    try {
      const qText = currentQ.question_text || currentQ.question
      const kws = currentQ.correct_answer_keywords || currentQ.keywords
      const r = await evaluateAnswer(transcript, qText, kws, age, GEMINI_KEY)
      setEvalResult(r)
      setRounds((prev) => [
        ...prev,
        {
          question: qText,
          answer: transcript,
          isCorrect: r.isCorrect,
          feedback: r.feedback,
          confidence: typeof r.confidence === 'number' ? r.confidence : null,
        },
      ])
    } catch (e) {
      setLoadError(e?.message || 'Evaluation failed.')
    } finally {
      setEvalLoading(false)
    }
  }, [currentQ, transcript, age])

  const nextQuestion = useCallback(() => {
    const lastIndex = Math.max(0, questions.length - 1)
    if (qIndex >= lastIndex) {
      setRounds((prev) => {
        const correct = prev.filter((r) => r.isCorrect === true).length
        const total = prev.length || questions.length || nQuestions
        navigate('/results', {
          state: {
            rounds: prev,
            title,
            selectedVoiceLabel,
            totalQuestions: total,
            correctCount: correct,
          },
        })
        return prev
      })
      return
    }
    setQIndex((i) => i + 1)
    setTranscript('')
    setEvalResult(null)
  }, [
    qIndex,
    questions.length,
    nQuestions,
    navigate,
    title,
    selectedVoiceLabel,
  ])

  const cantStartMic =
    !allowAnswer || ttsBusy || feedbackPlaying || evalLoading
  const showListenHint =
    step === 2 && ELEVEN_KEY && (!allowAnswer || ttsBusy || feedbackPlaying)

  const qProgress = nQuestions ? Math.round(((qIndex + 1) / nQuestions) * 100) : 0

  return (
    <div className="aa-page-fade aa-container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <header className="aa-topbar">
        <Link to="/" className="aa-back">
          Home
        </Link>
        {step === 2 && questions.length > 0 ? (
          <div style={{ flex: 1, minWidth: 200, maxWidth: 480 }}>
            <p className="aa-small" style={{ margin: '0 0 8px', fontWeight: 600 }}>
              📖 {title}
            </p>
            <p className="aa-small" style={{ margin: '0 0 8px' }}>
              Question {qIndex + 1} of {nQuestions}
            </p>
            <div className="aa-progress-track">
              <div
                className="aa-progress-fill"
                style={{ width: `${qProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="aa-small" style={{ fontWeight: 500 }}>
            New session
          </span>
        )}
        <span className="aa-small" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          Step {step}/3
        </span>
      </header>

      {!GEMINI_KEY && (
        <div
          className="aa-card"
          style={{
            marginBottom: '1.25rem',
            borderColor: 'rgba(249, 115, 22, 0.45)',
            background: 'rgba(154, 52, 18, 0.15)',
          }}
        >
          <p className="aa-body-text" style={{ color: '#fed7aa' }}>
            Add <code>VITE_GEMINI_API_KEY</code> to <code>.env</code> and restart
            the dev server.
          </p>
        </div>
      )}

      {!ELEVEN_KEY && step >= 2 && (
        <div
          className="aa-card"
          style={{
            marginBottom: '1.25rem',
            borderColor: 'rgba(249, 115, 22, 0.45)',
            background: 'rgba(154, 52, 18, 0.15)',
          }}
        >
          <p className="aa-body-text" style={{ color: '#fed7aa' }}>
            Add <code>VITE_ELEVENLABS_API_KEY</code> for read-aloud.
          </p>
        </div>
      )}

      {step === 1 && (
        <section className="aa-card">
          <h2 className="aa-page-title">Upload your PDF</h2>
          <p className="aa-small" style={{ marginBottom: '1.5rem' }}>
            We&apos;ll turn it into a short story and two questions. Voice:{' '}
            <strong style={{ color: 'var(--aa-text)' }}>
              {selectedVoiceLabel}
            </strong>{' '}
            — change anytime in the player or on the{' '}
            <Link to="/voices" className="aa-link">
              voice page
            </Link>
            .
          </p>

          <label className="aa-label">Narrator voice</label>
          <select
            className="aa-select"
            style={{ marginBottom: '1.25rem', maxWidth: 420 }}
            value={selectedVoice}
            onChange={(e) => onVoiceSelectChange(e.target.value)}
          >
            {VOICE_OPTIONS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <label className="aa-label">PDF file</label>
          <input
            type="file"
            accept="application/pdf"
            className="aa-input"
            style={{ marginBottom: '1.25rem', padding: '10px' }}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              setLoadError(null)
            }}
          />

          <label className="aa-label">Learner age</label>
          <input
            type="number"
            min={5}
            max={18}
            value={age}
            onChange={(e) => setAge(Number(e.target.value) || 10)}
            className="aa-input"
            style={{ marginBottom: '1.5rem', maxWidth: 140 }}
          />

          <button
            type="button"
            disabled={loading || !file || !GEMINI_KEY}
            className="aa-btn aa-btn-primary aa-btn-block"
            onClick={() => void handleGenerate()}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="aa-spinner" />
                Generating…
              </span>
            ) : (
              'Generate story'
            )}
          </button>
          {loadError && (
            <p className="aa-body-text" style={{ color: '#fdba74', marginTop: 16 }} role="alert">
              {loadError}
            </p>
          )}
        </section>
      )}

      {step === 2 && (
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
              marginBottom: '1rem',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--aa-text-muted)' }}>
              <IconSettings />
              <label className="aa-small" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                <span style={{ color: 'var(--aa-text-muted)' }}>Voice</span>
                <select
                  className="aa-select"
                  style={{ width: 'auto', minWidth: 200 }}
                  value={selectedVoice}
                  onChange={(e) => onVoiceSelectChange(e.target.value)}
                  aria-label="Narrator voice"
                >
                  {VOICE_OPTIONS.map(({ key, label }) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </span>
          </div>

          <section className="aa-card" style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h2 className="aa-card-title">{title}</h2>
              {ELEVEN_KEY && (
                <button
                  type="button"
                  className="aa-btn aa-btn-secondary"
                  style={{ minWidth: 'auto' }}
                  onClick={() => void readStoryAloud()}
                  disabled={ttsBusy || feedbackPlaying || isRecording}
                >
                  Read story
                </button>
              )}
            </div>
            <p className="aa-small" style={{ marginBottom: 8 }}>
              Story
            </p>
            <p
              className="aa-body-text"
              style={{
                fontSize: 'clamp(1.05rem, 2.2vw, 1.2rem)',
                lineHeight: 1.75,
                color: 'var(--aa-text)',
                whiteSpace: 'pre-wrap',
                textShadow: '0 2px 14px rgba(0,0,0,0.35)',
              }}
            >
              {story}
            </p>
          </section>

          <section className="aa-card">
            <p className="aa-small" style={{ marginBottom: '1rem' }}>
              Question {qIndex + 1} of {nQuestions}
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: '1.25rem',
                alignItems: 'flex-start',
              }}
            >
              <p
                className="aa-body-text"
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'clamp(1.2rem, 2.6vw, 1.5rem)',
                  fontWeight: 600,
                  color: 'var(--aa-text)',
                  lineHeight: 1.5,
                  textShadow: '0 2px 14px rgba(0,0,0,0.35)',
                }}
              >
                {currentQ?.question_text || currentQ?.question}
              </p>
              {ELEVEN_KEY && (
                <button
                  type="button"
                  className="aa-btn aa-btn-secondary"
                  style={{ minWidth: 'auto' }}
                  onClick={() => void readQuestionAgain()}
                  disabled={ttsBusy || feedbackPlaying || isRecording}
                >
                  Repeat question
                </button>
              )}
            </div>

            {showListenHint && (
              <div
                className="aa-card"
                style={{
                  marginBottom: '1.25rem',
                  background: 'rgba(168, 85, 247, 0.08)',
                  borderColor: 'rgba(168, 85, 247, 0.35)',
                }}
              >
                <p className="aa-body-text" style={{ color: '#ddd6fe', margin: 0 }}>
                  {ttsBusy
                    ? 'Listen to the story and question first.'
                    : feedbackPlaying
                      ? 'Listen to the feedback.'
                      : 'Wait for audio to finish, then record your answer.'}
                </p>
              </div>
            )}

            <div style={{ margin: '2rem 0', textAlign: 'center' }}>
              {evalLoading && (
                <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <MascotCharacter mood="think" size={100} />
                  <p className="aa-body-text" style={{ margin: 0 }}>
                    Thinking
                    <span className="aa-loading-dots" style={{ marginLeft: 8 }} aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                  </p>
                </div>
              )}
              <div className="aa-mic-wrap" style={{ margin: '0 auto', width: 140, height: 140 }}>
                {isRecording && (
                  <div className="aa-recording-rings" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                <button
                  type="button"
                  className={`aa-mic-btn aa-mic-btn--xl ${isRecording ? 'aa-mic-btn--recording' : ''}`}
                  style={{ position: 'relative', zIndex: 1 }}
                  onClick={() => (isRecording ? void stopMic() : void startMic())}
                  disabled={isRecording ? evalLoading : evalLoading || cantStartMic}
                  aria-label={isRecording ? 'Stop recording' : 'Record answer'}
                >
                  {isRecording ? <IconStop /> : <IconMic />}
                </button>
              </div>
              <p className="aa-body-text" style={{ textAlign: 'center', margin: '16px 0 0', maxWidth: 340 }}>
                {isRecording
                  ? 'Listening…'
                  : allowAnswer && !ttsBusy && !feedbackPlaying
                    ? 'Tap to answer'
                    : 'Wait for audio, then tap the mic'}
              </p>
            </div>

            {transcript ? (
              <div className="aa-transcript" style={{ marginBottom: '1rem' }}>
                <p className="aa-body-text" style={{ margin: 0, color: 'var(--aa-text)' }}>
                  <span style={{ color: 'var(--aa-cyan)', fontWeight: 700 }}>You said: </span>
                  {transcript}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              className="aa-btn aa-btn-secondary aa-btn-block"
              disabled={
                evalLoading ||
                !transcript.trim() ||
                !allowAnswer ||
                ttsBusy ||
                feedbackPlaying
              }
              onClick={() => void handleEvaluate()}
            >
              {evalLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span className="aa-spinner" />
                  Evaluating…
                </span>
              ) : (
                'Check answer'
              )}
            </button>

            {evalResult && (
              <div
                className="aa-card"
                style={{
                  marginTop: '1.25rem',
                  borderColor:
                    evalResult.isCorrect === true
                      ? 'rgba(16, 185, 129, 0.55)'
                      : 'rgba(245, 158, 11, 0.55)',
                  background:
                    evalResult.isCorrect === true
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(245, 158, 11, 0.1)',
                }}
              >
                <p className="aa-card-title" style={{ fontSize: '1.125rem' }}>
                  {evalResult.isCorrect === true
                    ? 'Great job — you got it!'
                    : evalResult.isCorrect === false
                      ? 'Good try — here is a hint'
                      : 'Let’s try that again'}
                </p>
                <p className="aa-body-text" style={{ marginTop: 8 }}>
                  {evalResult.feedback}
                </p>
                {ELEVEN_KEY && (
                  <button
                    type="button"
                    className="aa-btn aa-btn-secondary aa-btn-block"
                    style={{ marginTop: 16 }}
                    onClick={() => void hearFeedbackAgain()}
                    disabled={feedbackPlaying || ttsBusy}
                  >
                    Hear feedback again
                  </button>
                )}
              </div>
            )}

            {evalResult && (
              <button
                type="button"
                className="aa-btn aa-btn-primary aa-btn-block aa-btn-xl"
                style={{ marginTop: '1.25rem' }}
                onClick={nextQuestion}
                disabled={feedbackPlaying}
              >
                Continue
              </button>
            )}

            {loadError && (
              <p className="aa-body-text" style={{ color: '#fdba74', marginTop: 16 }}>
                {loadError}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
