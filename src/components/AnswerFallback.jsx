/**
 * Typed answer fallback when speech recognition is unavailable or user prefers typing.
 */
export default function AnswerFallback({
  value,
  onChange,
  onSubmit,
  disabled,
  errorMessage,
}) {
  return (
    <div className="rounded-2xl border-2 border-violet-500/40 bg-slate-900/90 p-6">
      <h3 className="mb-2 text-xl font-semibold text-slate-100">
        📝 Type your answer below
      </h3>
      <p className="mb-4 text-lg leading-relaxed text-slate-300">
        No problem — type what you would have said out loud.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={5}
        className="mb-4 w-full resize-y rounded-xl border-2 border-slate-600 bg-slate-950 px-4 py-4 text-lg leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 min-h-[120px]"
        placeholder="Type your answer here…"
      />
      {errorMessage && (
        <p className="mb-3 text-lg text-amber-200" role="alert">
          {errorMessage}
        </p>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="min-h-[52px] min-w-[min(100%,200px)] rounded-xl bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit answer
      </button>
    </div>
  )
}
