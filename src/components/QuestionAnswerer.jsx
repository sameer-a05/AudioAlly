import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isSpeechRecognitionSupported } from '../services/AudioEngine'
import { evaluateAnswerWithGemini } from '../services/GeminiEvaluator'
import { evaluateAnswer as evaluateAnswerBackend } from './api'
import AnswerFallback from './AnswerFallback'
import AnswerFeedback from './AnswerFeedback'

const SILENCE_MS = 10_000

function mapRecognitionError(ev) {
  const code = ev?.error || ''
  switch (code) {
    case 'no-speech':
      return "We didn't hear anything. Please try again and speak clearly."
    case 'not-allowed':
      return 'We need microphone access. Please check browser permissions.'
    case 'network':
      return 'Connection problem. Please try again.'
    case 'audio-capture':
      return "We couldn't reach your microphone. Check that it's plugged in."
    default:
      return 'Could not understand. Please try again.'
  }
}

/**
 * Full question UX: mic → STT → Gemini (or backend) → feedback → continue.
 */
export default function QuestionAnswerer({
  engine,
  questionSegment,
  childAge,
  learningNeeds = [],
  geminiApiKey,
  questionIndex,
  questionTotal,
  onComplete,
  onRecordAnswer,
  useComfortFont,
  onToggleComfortFont,
}) {
  const [uiPhase, setUiPhase] = useState('mic_idle')
  const [partialText, setPartialText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [speechBanner, setSpeechBanner] = useState(null)
  const [evaluation, setEvaluation] = useState(null)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [questionStartedAt] = useState(() => Date.now())
  const [secondsOnQuestion, setSecondsOnQuestion] = useState(0)

  const speechDetectedRef = useRef(false)
  const silenceTimerRef = useRef(null)
  const stopRecordingAndProcessRef = useRef(null)
  const uiPhaseRef = useRef(uiPhase)

  useLayoutEffect(() => {
    uiPhaseRef.current = uiPhase
  }, [uiPhase])

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsOnQuestion(Math.floor((Date.now() - questionStartedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [questionStartedAt])

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer()
    speechDetectedRef.current = false
    silenceTimerRef.current = window.setTimeout(() => {
      if (uiPhaseRef.current === 'recording' && !speechDetectedRef.current) {
        console.log('🎤 Auto-stop: no speech in', SILENCE_MS / 1000, 's')
        void stopRecordingAndProcessRef.current?.(true)
      }
    }, SILENCE_MS)
  }, [clearSilenceTimer])

  const runEvaluation = useCallback(
    async (answerText) => {
      console.log('📝 Evaluating answer:', answerText?.slice(0, 80))

      try {
        if (geminiApiKey) {
          const g = await evaluateAnswerWithGemini(
            answerText,
            questionSegment,
            childAge,
            learningNeeds,
            geminiApiKey,
          )
          if (g.error) {
            console.log('❌ Gemini returned error flag')
          }
          const normalized = {
            result: g.result,
            encouragement: g.feedback,
            explanation: g.explanation,
            confidence: g.confidence,
            feedback: g.feedback,
            isCorrect: g.isCorrect,
          }
          setEvaluation(normalized)
          return normalized
        }

        const r = await evaluateAnswerBackend(
          questionSegment,
          answerText,
          childAge,
          learningNeeds,
        )
        const normalized = {
          result: r.result || 'unclear',
          encouragement: r.encouragement,
          explanation: r.explanation,
          confidence: null,
          feedback: r.encouragement,
          isCorrect: r.result === 'correct',
        }
        setEvaluation(normalized)
        return normalized
      } catch (e) {
        console.log('❌ Evaluation failed:', e)
        const normalized = {
          result: 'unclear',
          encouragement:
            "We couldn't evaluate. Please try again or type your answer.",
          explanation: null,
          confidence: null,
          feedback:
            "We couldn't evaluate. Please try again or type your answer.",
          isCorrect: null,
        }
        setEvaluation(normalized)
        return normalized
      }
    },
    [
      geminiApiKey,
      questionSegment,
      childAge,
      learningNeeds,
    ],
  )

  const stopRecordingAndProcess = useCallback(
    async (fromSilence = false) => {
      clearSilenceTimer()
      setUiPhase('processing')
      setSpeechBanner(null)
      console.log('🔊 Stopping recording, processing speech…')

      try {
        const { transcript } = await engine.stopRecordingAndTranscribe()
        const trimmed = (transcript || '').trim()
        console.log('📝 Transcript:', trimmed)
        setFinalText(trimmed)
        setPartialText('')

        if (!trimmed) {
          setSpeechBanner(
            fromSilence
              ? "We didn't hear anything. Please try again and speak clearly."
              : "We didn't catch that. Try again or use typing.",
          )
          setUiPhase('mic_idle')
          return
        }

        setUiPhase('evaluating')
        const ev = await runEvaluation(trimmed)
        setUiPhase('feedback')

        onRecordAnswer?.({
          segmentId: questionSegment.id,
          childAnswer: trimmed,
          isCorrect: ev.result === 'correct',
          confidence: ev.confidence,
          feedback: ev.encouragement || ev.feedback,
          timestamp: Date.now(),
        })
      } catch (e) {
        console.log('❌ stopRecordingAndProcess:', e)
        setSpeechBanner('Something went wrong. Try again or type your answer.')
        setUiPhase('mic_idle')
      }
    },
    [
      engine,
      clearSilenceTimer,
      runEvaluation,
      questionSegment,
      onRecordAnswer,
    ],
  )

  useLayoutEffect(() => {
    stopRecordingAndProcessRef.current = stopRecordingAndProcess
  }, [stopRecordingAndProcess])

  const startRecording = useCallback(async () => {
    setSpeechBanner(null)
    setFinalText('')
    setPartialText('')
    setEvaluation(null)
    console.log('🎤 Start recording (question)')

    if (!isSpeechRecognitionSupported()) {
      setSpeechBanner(
        "Your browser doesn't support voice. Please type instead.",
      )
      setUiPhase('type_mode')
      return
    }

    try {
      await engine.startRecording({
        onVolumeLevel: (lvl) => {
          if (uiPhaseRef.current === 'recording') setVolumeLevel(lvl)
        },
        onSpeechActivity: () => {
          speechDetectedRef.current = true
          clearSilenceTimer()
          console.log('🔊 Speech activity detected')
        },
        onPartialTranscript: (t) => setPartialText(t),
        onRecognitionError: (ev) => {
          const msg = mapRecognitionError(ev)
          console.log('❌ Speech recognition:', ev?.error, msg)
          setSpeechBanner(msg)
        },
      })
      setUiPhase('recording')
      setVolumeLevel(0)
      armSilenceTimer()
    } catch (e) {
      console.log('❌ Mic error:', e)
      if (e?.name === 'NotAllowedError') {
        setSpeechBanner(
          'We need microphone access. Please check browser permissions.',
        )
      } else {
        setSpeechBanner(String(e?.message || e))
      }
      setUiPhase('type_mode')
    }
  }, [engine, armSilenceTimer, clearSilenceTimer])

  const submitTyped = useCallback(async () => {
    const t = typedAnswer.trim()
    if (!t) return
    setSpeechBanner(null)
    setFinalText(t)
    setUiPhase('evaluating')
    const ev = await runEvaluation(t)
    setUiPhase('feedback')
    onRecordAnswer?.({
      segmentId: questionSegment.id,
      childAnswer: t,
      isCorrect: ev.result === 'correct',
      confidence: ev.confidence,
      feedback: ev.encouragement || ev.feedback,
      timestamp: Date.now(),
    })
  }, [typedAnswer, runEvaluation, questionSegment, onRecordAnswer])

  const handleContinue = useCallback(() => {
    const branch = evaluation?.result || 'unclear'
    console.log(
      branch === 'correct' ? '✅ Continuing (correct)' : '⚠️ Continuing',
      branch,
    )
    onComplete?.(branch, {
      segmentId: questionSegment.id,
      childAnswer: finalText || typedAnswer,
      evaluation,
    })
  }, [evaluation, onComplete, questionSegment, finalText, typedAnswer])

  const tryAgain = useCallback(() => {
    setEvaluation(null)
    setFinalText('')
    setTypedAnswer('')
    setSpeechBanner(null)
    setUiPhase('mic_idle')
  }, [])

  const pickFallbackChoice = useCallback(
    async (choice) => {
      const t = (choice || '').trim()
      if (!t) return
      setSpeechBanner(null)
      setFinalText(t)
      setTypedAnswer(t)
      setUiPhase('evaluating')
      const ev = await runEvaluation(t)
      setUiPhase('feedback')
      onRecordAnswer?.({
        segmentId: questionSegment.id,
        childAnswer: t,
        isCorrect: ev.result === 'correct',
        confidence: ev.confidence,
        feedback: ev.encouragement || ev.feedback,
        timestamp: Date.now(),
      })
    },
    [runEvaluation, questionSegment, onRecordAnswer],
  )

  const srOk = isSpeechRecognitionSupported()

  return (
    <div
      className={`space-y-6 ${useComfortFont ? 'font-[Lexend,sans-serif]' : ''}`}
    >
      {typeof onToggleComfortFont === 'function' && (
        <label className="flex cursor-pointer items-center gap-3 text-lg text-slate-300">
          <input
            type="checkbox"
            checked={useComfortFont}
            onChange={(e) => onToggleComfortFont(e.target.checked)}
            className="h-6 w-6 rounded border-violet-500 text-violet-600"
          />
          Easier-reading font (Lexend)
        </label>
      )}

      <div className="rounded-2xl border-2 border-violet-500/50 bg-violet-950/30 p-6 md:p-8">
        <p className="mb-2 text-base font-medium text-violet-300/90">
          Question {questionIndex} of {questionTotal}
        </p>
        <h2 className="mb-6 text-2xl font-bold leading-snug text-slate-50 md:text-3xl md:leading-tight">
          {questionSegment?.question_text || questionSegment?.text}
        </h2>

        {speechBanner && (
          <p
            className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-lg text-amber-100"
            role="status"
          >
            {speechBanner}
          </p>
        )}

        {/* Mic idle */}
        {uiPhase === 'mic_idle' && (
          <div className="flex flex-col items-center gap-6">
            <button
              type="button"
              onClick={startRecording}
              className="flex min-h-[64px] min-w-[64px] flex-col items-center justify-center gap-2 rounded-full bg-violet-600 px-10 py-8 text-xl font-bold text-white shadow-xl transition hover:bg-violet-500"
            >
              <span className="text-4xl" aria-hidden>
                🎤
              </span>
              Click to start
            </button>
            <p className="text-center text-lg text-slate-400">
              One step at a time. Tap the mic when you&apos;re ready.
            </p>
            {srOk && (
              <button
                type="button"
                onClick={() => {
                  setUiPhase('type_mode')
                  setSpeechBanner(null)
                }}
                className="min-h-[48px] rounded-xl border border-slate-600 px-6 py-3 text-lg text-violet-200 hover:bg-slate-800"
              >
                ⌨️ Type instead
              </button>
            )}
            {!srOk && (
              <button
                type="button"
                onClick={() => setUiPhase('type_mode')}
                className="min-h-[48px] rounded-xl bg-violet-700 px-6 py-3 text-lg text-white"
              >
                ⌨️ Type your answer
              </button>
            )}
            {questionSegment?.fallback_choices?.length > 0 && (
              <div className="w-full border-t border-slate-700 pt-6 text-center">
                <p className="mb-3 text-lg text-slate-400">Or tap an answer:</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {questionSegment.fallback_choices.map((choice, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => void pickFallbackChoice(choice)}
                      className="min-h-[48px] rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-lg text-slate-100 hover:border-violet-400"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recording */}
        {uiPhase === 'recording' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div
                className="relative flex h-16 w-16 items-center justify-center"
                aria-hidden
              >
                <span className="absolute h-14 w-14 animate-pulse rounded-full bg-violet-500/30 [animation-duration:2.2s]" />
                <span className="relative text-4xl">🎤</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-200">
                  Recording… speak now!
                </p>
                <p className="text-lg text-slate-400">
                  Tap stop when you&apos;re finished.
                </p>
              </div>
            </div>
            <div className="h-4 w-full max-w-md overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width]"
                style={{ width: `${volumeLevel}%` }}
              />
            </div>
            {partialText && (
              <p className="text-lg italic text-slate-300">
                Live: {partialText}
              </p>
            )}
            <button
              type="button"
              onClick={() => void stopRecordingAndProcess(false)}
              className="min-h-[52px] rounded-xl border-2 border-violet-400 bg-violet-950/60 px-8 py-4 text-lg font-semibold text-violet-100"
            >
              ⏸️ Stop &amp; submit
            </button>
          </div>
        )}

        {/* Processing */}
        {uiPhase === 'processing' && (
          <div className="flex items-center gap-3 text-xl text-violet-200">
            <span
              className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent"
              aria-hidden
            />
            Processing your speech…
          </div>
        )}

        {/* Evaluating */}
        {uiPhase === 'evaluating' && (
          <div className="flex items-center gap-3 text-xl text-violet-200">
            <span
              className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent"
              aria-hidden
            />
            💭 Evaluating your answer…
          </div>
        )}

        {/* Feedback */}
        {uiPhase === 'feedback' && evaluation && (
          <AnswerFeedback
            evaluation={{
              ...evaluation,
              feedback: evaluation.feedback || evaluation.encouragement,
            }}
            questionIndex={questionIndex}
            questionTotal={questionTotal}
            secondsOnQuestion={secondsOnQuestion}
            childAnswer={finalText || typedAnswer}
            onContinue={handleContinue}
            onTryAgain={tryAgain}
          />
        )}

        {/* Type fallback */}
        {uiPhase === 'type_mode' && (
          <div className="space-y-4">
            <AnswerFallback
              value={typedAnswer}
              onChange={setTypedAnswer}
              onSubmit={() => void submitTyped()}
              disabled={uiPhase === 'evaluating'}
              errorMessage={null}
            />
            {srOk && (
              <button
                type="button"
                onClick={() => {
                  setUiPhase('mic_idle')
                  setTypedAnswer('')
                }}
                className="min-h-[48px] text-lg text-violet-300 underline"
              >
                🎤 Try voice instead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
