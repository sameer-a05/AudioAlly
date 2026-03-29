/**
 * Large, friendly evaluation display: correct / incorrect / unclear.
 * ADHD-friendly: one primary action, high contrast, no harsh reds.
 */
export default function AnswerFeedback({
  evaluation,
  questionIndex,
  questionTotal,
  secondsOnQuestion,
  childAnswer,
  onContinue,
  onTryAgain,
}) {
  const isCorrect = evaluation?.result === 'correct'
  const isUnclear = evaluation?.result === 'unclear'

  return (
    <div
      className={`rounded-2xl border-2 p-6 md:p-8 ${
        isCorrect
          ? 'border-emerald-500/50 bg-emerald-950/40'
          : isUnclear
            ? 'border-slate-500/50 bg-slate-800/80'
            : 'border-amber-400/40 bg-amber-950/25'
      }`}
    >
      <p className="mb-2 text-base font-medium text-slate-400">
        Question {questionIndex} of {questionTotal}
        {typeof secondsOnQuestion === 'number' && (
          <span className="text-slate-500">
            {' '}
            · {secondsOnQuestion}s on this question
          </span>
        )}
      </p>

      <div className="mb-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        {isCorrect ? (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-5xl shadow-lg shadow-emerald-900/50"
            aria-hidden
          >
            ✅
          </div>
        ) : isUnclear ? (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-600 text-4xl"
            aria-hidden
          >
            💬
          </div>
        ) : (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amber-700/80 text-4xl"
            aria-hidden
          >
            ⚠️
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-2xl font-bold leading-tight text-slate-50 md:text-3xl">
            {isCorrect
              ? 'Nice work!'
              : isUnclear
                ? "Let's keep going"
                : 'Good try!'}
          </h3>
          <p className="text-xl leading-relaxed text-slate-100 md:text-2xl">
            {evaluation?.encouragement ||
              evaluation?.feedback ||
              "Thanks for answering!"}
          </p>
        </div>
      </div>

      {childAnswer && (
        <p className="mb-4 rounded-xl bg-slate-950/50 px-4 py-3 text-lg text-slate-200">
          <span className="font-medium text-violet-300">You said: </span>
          {childAnswer}
        </p>
      )}

      {evaluation?.explanation && (
        <p className="mb-6 text-lg leading-relaxed text-slate-300 md:text-xl">
          <span className="font-semibold text-violet-200">Why: </span>
          {evaluation.explanation}
        </p>
      )}

      {evaluation?.confidence != null && !isUnclear && (
        <p className="mb-6 text-base text-slate-400">
          Confidence: {evaluation.confidence}%
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onContinue}
          className="min-h-[52px] w-full max-w-md rounded-xl bg-violet-600 px-8 py-4 text-xl font-semibold text-white shadow-lg transition hover:bg-violet-500 sm:w-auto"
        >
          ➡️ Continue
        </button>
        {typeof onTryAgain === 'function' && (
          <button
            type="button"
            onClick={onTryAgain}
            className="min-h-[52px] rounded-xl border-2 border-violet-400/50 bg-slate-900/80 px-8 py-4 text-xl font-semibold text-violet-100 hover:bg-slate-800"
          >
            🎤 Try again
          </button>
        )}
      </div>
    </div>
  )
}
