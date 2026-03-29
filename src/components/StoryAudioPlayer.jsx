import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AudioEngine from '../services/AudioEngine'
import { generateStory, evaluateAnswer, uploadPdf } from './api'

// ─── Phases ─────────────────────────────────────────────────────────────────
// idle → configuring → generating → playing → question → answering → evaluating → playing → done

export default function StoryAudioPlayer({ elevenLabsApiKey }) {
  const engine = useMemo(() => new AudioEngine(elevenLabsApiKey || ''), [elevenLabsApiKey])

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

  // Question/evaluation state
  const [questionSegment, setQuestionSegment] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [evalResult, setEvalResult] = useState(null)
  const questionResolveRef = useRef(null)

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
    setEvalResult(null)

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
    setTranscript('')
    setEvalResult(null)

    // Return a promise that resolves when the child answers and we evaluate
    return new Promise((resolve) => {
      questionResolveRef.current = resolve
    })
  }, [])

  // ─── Start/Stop Recording ─────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setTranscript('')
    setIsRecording(true)
    setPhase('answering')
    try {
      await engine.startRecording({
        onPartialTranscript: (text) => setTranscript(text),
        onSpeechActivity: () => {},
        onRecognitionError: () => {},
      })
    } catch (err) {
      setIsRecording(false)
      setError('Mic error: ' + err.message)
    }
  }, [engine])

  const stopRecordingAndEvaluate = useCallback(async () => {
    setPhase('evaluating')
    try {
      const { transcript: finalText } = await engine.stopRecordingAndTranscribe()
      setIsRecording(false)
      setTranscript(finalText || '')

      if (!finalText?.trim()) {
        const result = { result: 'unclear', encouragement: "I didn't catch that — let's keep going!", explanation: null }
        setEvalResult(result)
        // Auto-continue after 2 seconds
        setTimeout(() => { questionResolveRef.current?.(result.result) }, 2000)
        return
      }

      // Call the evaluation API
      const result = await evaluateAnswer(
        questionSegment,
        finalText,
        childAge,
        learningNeeds.length ? learningNeeds : ['none']
      )
      setEvalResult(result)

      // Show result for 3 seconds, then continue story
      setTimeout(() => {
        questionResolveRef.current?.(result.result)
        setPhase('playing')
      }, 3500)
    } catch (err) {
      setIsRecording(false)
      // Never crash on evaluation failure
      const fallback = { result: 'unclear', encouragement: "Let's keep going with the story!", explanation: null }
      setEvalResult(fallback)
      setTimeout(() => { questionResolveRef.current?.('unclear') }, 2000)
    }
  }, [engine, questionSegment, childAge, learningNeeds])

  // ─── Fallback Button Answer ───────────────────────────────────────

  const handleFallbackChoice = useCallback(async (choiceIndex) => {
    setPhase('evaluating')
    const isCorrect = choiceIndex === 0 // First choice is always correct per schema
    const result = isCorrect
      ? { result: 'correct', encouragement: 'Great job! You got it right!', explanation: null }
      : { result: 'incorrect', encouragement: "Good try! Let me explain a bit more…", explanation: questionSegment?.hint_text || null }

    setEvalResult(result)
    setTimeout(() => {
      questionResolveRef.current?.(result.result)
      setPhase('playing')
    }, 3000)
  }, [questionSegment])

  // ─── Play Story ───────────────────────────────────────────────────

  const playStory = useCallback(async () => {
    if (!story) return
    setPhase('playing')
    setError(null)
    setEvalResult(null)

    try {
      await engine.playStory(story, {
        onSegmentStart: (seg) => setCurrentSegment(seg),
        onQuestion: handleQuestion,
        onStoryEnd: () => setPhase('done'),
      })
    } catch (err) {
      if (!err.message?.includes('Playback error')) {
        setError(err.message)
      }
      setPhase('done')
    }
  }, [engine, story, handleQuestion])

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
  const isActive = ['playing', 'question', 'answering', 'evaluating'].includes(phase)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-16">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-violet-500/30 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Audio Ally</h1>
        <Link to="/" className="rounded-xl border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-950/60">← Home</Link>
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
                  ✅ <strong>{uploadStatus.filename}</strong> — {uploadStatus.text_length} characters extracted
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

          {/* Question phase */}
          {(phase === 'question' || phase === 'answering') && questionSegment && (
            <div className="mb-5 rounded-xl border-2 border-violet-500/40 bg-violet-950/30 p-5">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-violet-400">❓ Question</p>
              <p className="mb-5 text-xl leading-relaxed text-slate-100">
                {questionSegment.question_text}
              </p>

              {/* Voice answer */}
              {!isRecording && phase === 'question' && (
                <div className="flex flex-col gap-4">
                  <button onClick={startRecording}
                    className="rounded-xl bg-violet-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg transition hover:bg-violet-500">
                    🎤 Tap to Answer
                  </button>

                  {/* Fallback buttons */}
                  {questionSegment.fallback_choices?.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs text-slate-500">Or tap an answer:</p>
                      <div className="flex flex-wrap gap-2">
                        {questionSegment.fallback_choices.map((choice, i) => (
                          <button key={i} onClick={() => handleFallbackChoice(i)}
                            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 transition hover:border-violet-400 hover:bg-slate-700">
                            {choice}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recording active */}
              {isRecording && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-10 w-10 items-center justify-center">
                      <span className="absolute h-10 w-10 animate-ping rounded-full bg-red-500/40" />
                      <span className="h-6 w-6 rounded-full bg-red-500" />
                    </span>
                    <span className="text-lg font-medium text-red-300">Listening…</span>
                  </div>
                  {transcript && <p className="text-sm italic text-slate-400">"{transcript}"</p>}
                  <button onClick={stopRecordingAndEvaluate}
                    className="rounded-xl border-2 border-violet-400/50 bg-violet-950/50 px-6 py-3 text-base font-semibold text-violet-100 transition hover:bg-violet-900/60">
                    Done — Submit Answer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Evaluation result */}
          {(phase === 'evaluating' || evalResult) && evalResult && (
            <div className={`mb-5 rounded-xl p-5 ${
              evalResult.result === 'correct'
                ? 'border-2 border-green-500/40 bg-green-950/30'
                : evalResult.result === 'incorrect'
                ? 'border-2 border-amber-500/40 bg-amber-950/20'
                : 'border-2 border-slate-500/40 bg-slate-800/50'
            }`}>
              <p className="text-2xl mb-2">
                {evalResult.result === 'correct' ? '🌟' : evalResult.result === 'incorrect' ? '💪' : '🔄'}
              </p>
              <p className="text-lg font-medium text-slate-100">{evalResult.encouragement}</p>
              {evalResult.explanation && (
                <p className="mt-2 text-sm text-slate-300">{evalResult.explanation}</p>
              )}
              <p className="mt-2 text-xs text-slate-500">Continuing story…</p>
            </div>
          )}
        </section>
      )}

      {/* Done */}
      {phase === 'done' && (
        <section className="rounded-2xl border-2 border-green-500/30 bg-green-950/20 p-8 text-center shadow-xl">
          <p className="mb-2 text-4xl">🎉</p>
          <h2 className="mb-2 text-2xl font-bold text-green-200">Story Complete!</h2>
          <p className="mb-5 text-slate-400">Great job listening and answering!</p>
          <button onClick={() => { setPhase('idle'); setStory(null); setEvalResult(null) }}
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
      {!elevenLabsApiKey && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
          Add <code className="text-amber-200">VITE_ELEVENLABS_API_KEY</code> to <code className="text-amber-200">.env</code>
        </p>
      )}
    </div>
  )
}
