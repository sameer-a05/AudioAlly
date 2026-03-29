import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AudioEngine from '../services/AudioEngine'
import { useVoice } from '../context/VoiceContext'
import { useStorySession } from '../context/StorySessionContext'
import QuestionAnswerer from './QuestionAnswerer'
import { generateStory, uploadPdf } from './api'

// ─── Phases ─────────────────────────────────────────────────────────────────
// idle → configuring → generating → playing → question → answering → evaluating → playing → done

export default function StoryAudioPlayer({ elevenLabsApiKey }) {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
  const engine = useMemo(() => new AudioEngine(elevenLabsApiKey || ''), [elevenLabsApiKey])
  const { appliedVoice } = useVoice()
  const { startSession, recordAnswer, completeSession, answers, score } = useStorySession()
  const [comfortFont, setComfortFont] = useState(false)

  useEffect(() => {
    engine.setPreferredVoiceKey(appliedVoice)
  }, [engine, appliedVoice])

  // Story config
  const [inputMode, setInputMode] = useState('topic') // 'topic' | 'pdf'
  const [topic, setTopic] = useState('')
  const [childAge, setChildAge] = useState(10)
  const [learningNeeds, setLearningNeeds] = useState([])
  const [numQuestions, setNumQuestions] = useState(2)

  // PDF upload
  const [uploadStatus, setUploadStatus] = useState(null) // null | 'uploading' | {document_id, filename, text_preview}
  const [uploadError, setUploadError] = useState(null)

  // Story state
  const [phase, setPhase] = useState('idle')
  const [story, setStory] = useState(null)
  const [currentSegment, setCurrentSegment] = useState(null)
  const [error, setError] = useState(null)

  const [questionSegment, setQuestionSegment] = useState(null)
  const questionResolveRef = useRef(null)

  const questionSegments = useMemo(
    () => (story?.segments || []).filter((s) => s.type === 'question'),
    [story],
  )
  const questionNumber = useMemo(() => {
    if (!questionSegment) return 1
    const i = questionSegments.findIndex((s) => s.id === questionSegment.id)
    return i >= 0 ? i + 1 : 1
  }, [questionSegment, questionSegments])

  useEffect(() => () => engine.cleanup(), [engine])

  // ─── PDF Upload ─────────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploadStatus('uploading')
    try {
      const result = await uploadPdf(file)
      setUploadStatus(result)
    } catch (err) {
      setUploadError(err.message)
      setUploadStatus(null)
    }
  }, [])

  // ─── Generate Story ─────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setError(null)
    setStory(null)
    setPhase('generating')
    setCurrentSegment(null)
    const params = {
      child_age: childAge,
      learning_needs: learningNeeds.length ? learningNeeds : ['none'],
      num_questions: numQuestions,
    }

    if (inputMode === 'topic') {
      if (!topic.trim()) { setError('Enter a topic'); setPhase('idle'); return }
      params.topic = topic.trim()
    } else {
      if (!uploadStatus?.document_id) { setError('Upload a PDF first'); setPhase('idle'); return }
      params.document_id = uploadStatus.document_id
    }

    try {
      const storyJson = await generateStory(params)
      setStory(storyJson)
      setPhase('ready')
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }, [inputMode, topic, childAge, learningNeeds, numQuestions, uploadStatus])

  // ─── Question Handler (called by AudioEngine during playback) ─────

  const handleQuestion = useCallback(async (segment) => {
    setQuestionSegment(segment)
    setPhase('question')

    return new Promise((resolve) => {
      questionResolveRef.current = resolve
    })
  }, [])

  const handleQuestionComplete = useCallback(
    (branch) => {
      const normalized =
        branch === 'correct' || branch === 'incorrect' || branch === 'unclear'
          ? branch
          : 'unclear'
      questionResolveRef.current?.(normalized)
      setQuestionSegment(null)
      setPhase('playing')
    },
    [],
  )

  // ─── Play Story ───────────────────────────────────────────────────

  const playStory = useCallback(async () => {
    if (!story) return
    setPhase('playing')
    setError(null)
    startSession(story.id || story.title || 'story')

    try {
      await engine.playStory(story, {
        onSegmentStart: (seg) => setCurrentSegment(seg),
        onQuestion: handleQuestion,
        onStoryEnd: () => {
          completeSession()
          setPhase('done')
        },
      })
    } catch (err) {
      if (!err.message?.includes('Playback error')) {
        setError(err.message)
      }
      completeSession()
      setPhase('done')
    }
  }, [engine, story, handleQuestion, startSession, completeSession])

  const stopStory = useCallback(() => {
    engine.stopStory()
    setPhase('idle')
  }, [engine])

  // ─── Toggle learning need ─────────────────────────────────────────

  const toggleNeed = (need) => {
    setLearningNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    )
  }

  // ─── Render ───────────────────────────────────────────────────────

  const isConfiguring = phase === 'idle' || phase === 'ready'
  const isActive = ['playing', 'question'].includes(phase)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-16">
      <div className="mb-6 flex justify-end">
        <Link
          to="/"
          className="rounded-xl border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-950/60"
        >
          ← Home
        </Link>
      </div>

      {/* Step 1: Input */}
      {isConfiguring && (
        <section className="mb-6 rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">What should we learn about?</h2>

          {/* Mode tabs */}
          <div className="mb-5 flex gap-2">
            <button onClick={() => setInputMode('topic')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${inputMode === 'topic' ? 'bg-violet-600 text-white' : 'border border-slate-600 text-slate-300 hover:border-violet-400'}`}>
              Type a topic
            </button>
            <button onClick={() => setInputMode('pdf')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${inputMode === 'pdf' ? 'bg-violet-600 text-white' : 'border border-slate-600 text-slate-300 hover:border-violet-400'}`}>
              Upload a PDF
            </button>
          </div>

          {/* Topic input */}
          {inputMode === 'topic' && (
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The American Revolution, Photosynthesis, The Water Cycle"
              className="mb-4 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-violet-400 focus:outline-none" />
          )}

          {/* PDF upload */}
          {inputMode === 'pdf' && (
            <div className="mb-4">
              <input type="file" accept="application/pdf" onChange={handleFileUpload}
                className="mb-2 block text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500" />
              {uploadStatus === 'uploading' && <p className="text-sm text-violet-300">Uploading and extracting text…</p>}
              {uploadStatus?.document_id && (
                <div className="rounded-lg border border-green-500/30 bg-green-950/30 px-3 py-2 text-sm text-green-200">
                  ✅ <strong>{uploadStatus.filename}</strong>, {uploadStatus.text_length} characters extracted
                  <p className="mt-1 text-xs text-green-300/70">{uploadStatus.text_preview}</p>
                </div>
              )}
              {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
            </div>
          )}

          {/* Config row */}
          <div className="mb-5 flex flex-wrap gap-4">
            <label className="text-sm text-slate-300">
              Age:
              <select value={childAge} onChange={(e) => setChildAge(Number(e.target.value))}
                className="ml-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-slate-100">
                {[5,6,7,8,9,10,11,12,13,14,15,16].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              Questions:
              <select value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="ml-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-slate-100">
                {[1,2,3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          {/* Learning needs */}
          <div className="mb-5 flex flex-wrap gap-2">
            {[['adhd','ADHD'],['dyslexia','Dyslexia'],['esl','ESL']].map(([val, label]) => (
              <button key={val} onClick={() => toggleNeed(val)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${learningNeeds.includes(val) ? 'bg-violet-600 text-white' : 'border border-slate-600 text-slate-400 hover:border-violet-400'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={phase === 'generating'}
            className="rounded-xl bg-violet-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500 disabled:opacity-50">
            {phase === 'generating' ? 'Generating story…' : '✨ Generate Story'}
          </button>

          {/* Play button (after generation) */}
          {phase === 'ready' && story && (
            <div className="mt-5 rounded-xl border border-green-500/30 bg-green-950/20 p-4">
              <p className="mb-3 text-lg font-semibold text-green-200">📖 {story.title}</p>
              <p className="mb-3 text-sm text-slate-400">
                {story.segments?.length} segments · {Object.keys(story.voices || {}).length} voices ·
                ~{story.estimated_duration_minutes} min
              </p>
              <button onClick={playStory}
                className="rounded-xl bg-green-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg transition hover:bg-green-500">
                ▶ Play Story
              </button>
            </div>
          )}
        </section>
      )}

      {/* Active playback UI */}
      {isActive && (
        <section className="rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
          {/* Now playing */}
          {story && (
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">📖 {story.title}</h2>
              <button onClick={stopStory}
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-950/40">
                Stop
              </button>
            </div>
          )}

          {/* Current segment display */}
          {currentSegment && phase === 'playing' && (
            <div className="mb-5 rounded-xl bg-slate-800/80 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-violet-400">
                {currentSegment.type === 'intro' ? '🎬 Intro' :
                 currentSegment.type === 'recap' ? '🏁 Recap' :
                 `🎙 ${currentSegment.speaker || 'narrator'}`}
              </p>
              <p className="text-lg leading-relaxed text-slate-200">
                {currentSegment.text || currentSegment.question_text}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                <span className="text-sm text-violet-300">Playing…</span>
              </div>
            </div>
          )}

          {phase === 'question' && questionSegment && (
            <QuestionAnswerer
              key={questionSegment.id}
              engine={engine}
              questionSegment={questionSegment}
              childAge={childAge}
              learningNeeds={learningNeeds.length ? learningNeeds : ['none']}
              geminiApiKey={geminiApiKey}
              questionIndex={questionNumber}
              questionTotal={Math.max(questionSegments.length, 1)}
              onComplete={(branch) => handleQuestionComplete(branch)}
              onRecordAnswer={(entry) => recordAnswer(entry)}
              useComfortFont={comfortFont}
              onToggleComfortFont={setComfortFont}
            />
          )}
        </section>
      )}

      {/* Done */}
      {phase === 'done' && (
        <section className="rounded-2xl border-2 border-green-500/30 bg-green-950/20 p-8 text-center shadow-xl">
          <p className="mb-2 text-4xl">🎉</p>
          <h2 className="mb-2 text-2xl font-bold text-green-200">Story Complete!</h2>
          <p className="mb-2 text-lg text-slate-300">
            Your score: <strong className="text-violet-200">{score.fraction}</strong> correct
            {answers.length > 0 && (
              <span className="block text-sm text-slate-500">
                {answers.length} answer{answers.length !== 1 ? 's' : ''} recorded
              </span>
            )}
          </p>
          <p className="mb-5 text-slate-400">Great job listening and answering!</p>
          <button onClick={() => { setPhase('idle'); setStory(null) }}
            className="rounded-xl bg-violet-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-violet-500">
            Start a New Story
          </button>
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 p-4">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="mt-2 text-xs text-red-400 underline">Dismiss</button>
        </div>
      )}

      {/* API key warning */}
      <div className="mt-4 space-y-2">
        {!elevenLabsApiKey && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
            Add <code className="text-amber-200">VITE_ELEVENLABS_API_KEY</code> to <code className="text-amber-200">.env</code>
          </p>
        )}
        {!geminiApiKey && (
          <p className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-300">
            Optional: add <code className="text-violet-300">VITE_GEMINI_API_KEY</code> for on-device answer
            evaluation (otherwise the Python backend is used).
          </p>
        )}
      </div>
    </div>
  )
}
