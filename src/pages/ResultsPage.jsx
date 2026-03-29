import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Navigation from '../components/Navigation'
import MascotCharacter from '../components/MascotCharacter'
import { IconCheckCircle, IconXCircle } from '../components/icons/BrandIcons'

function Confetti({ active }) {
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: `${(i * 41) % 100}%`,
      delay: `${(i % 10) * 0.06}s`,
      bg: ['#7c3aed', '#06b6d4', '#fbbf24', '#a78bfa', '#34d399', '#f97316'][i % 6],
    })),
  )
  if (!active) return null
  return (
    <div className="aa-confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: p.left,
            top: '-8%',
            background: p.bg,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  )
}

export default function ResultsPage() {
  const location = useLocation()
  const state = location.state

  const rounds = state?.rounds
  const title = state?.title ?? 'Your session'
  const totalQuestions = state?.totalQuestions ?? rounds?.length ?? 0
  const correctCount =
    typeof state?.correctCount === 'number'
      ? state.correctCount
      : (rounds?.filter((r) => r.isCorrect === true).length ?? 0)

  const pct =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

  const tier = useMemo(() => {
    if (pct > 80) return 'high'
    if (pct >= 40) return 'mid'
    return 'low'
  }, [pct])

  const headline = useMemo(() => {
    if (pct === 100 && totalQuestions > 0) return 'Excellent work! You nailed it.'
    if (pct > 80) return 'Great job! You understood the key ideas.'
    if (pct >= 40) return 'Nice effort — you’re getting stronger every round.'
    return 'That was a good try. Let’s use the feedback and go again.'
  }, [pct, totalQuestions])

  const encourage = useMemo(() => {
    if (pct === 100) return 'Ready for another story when you are.'
    if (pct >= 40) return 'You’re building real skills—keep the momentum going.'
    return 'Learning sticks when we practice. Another round will feel easier.'
  }, [pct])

  if (!rounds?.length) {
    return <Navigate to="/" replace />
  }

  const perfect = pct === 100 && totalQuestions > 0

  return (
    <div className="aa-page aa-page-enter">
      <Navigation />
      <Confetti active={perfect} />
      <div
        className="aa-container"
        style={{
          paddingTop: 20,
          paddingBottom: 72,
          background: 'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 35%)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <MascotCharacter mood={perfect ? 'celebrate' : 'encourage'} size={120} />
        </div>

        <header style={{ textAlign: 'center', marginBottom: 32 }}>
          <p className="aa-small" style={{ letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Session complete
          </p>
          <h1 className="aa-display" style={{ fontSize: 'clamp(1.85rem, 4vw, 2.5rem)' }}>
            {headline}
          </h1>
          <p className="aa-body-text" style={{ marginTop: 10, color: 'var(--aa-text-muted)' }}>
            {title}
          </p>
        </header>

        <section style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className={`aa-score-ring-wrap ${perfect ? 'aa-bounce' : ''}`}>
            <div className="aa-score-ring-inner">
              <span className="aa-score-ring__value" style={{ fontSize: '2.5rem' }}>
                {correctCount}/{totalQuestions}
              </span>
              <span className="aa-score-ring__pct">{pct}%</span>
            </div>
          </div>
          <p
            className="aa-subhead"
            style={{
              maxWidth: 460,
              margin: '0 auto',
              color:
                tier === 'high'
                  ? 'var(--aa-success)'
                  : tier === 'mid'
                    ? 'var(--aa-warning)'
                    : 'var(--aa-cyan)',
            }}
          >
            {encourage}
          </p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 44 }}>
          {rounds.map((r, i) => {
            const conf =
              typeof r.confidence === 'number' && !Number.isNaN(r.confidence)
                ? Math.round(r.confidence)
                : null
            return (
              <article
                key={i}
                className={`aa-card aa-stagger-item aa-result-grid ${r.isCorrect ? 'aa-card--correct' : 'aa-card--incorrect'}`}
                style={{
                  '--stagger-delay': `${i * 100}ms`,
                  borderRadius: 20,
                  borderLeftWidth: 5,
                  borderLeftStyle: 'solid',
                  borderLeftColor: r.isCorrect ? 'var(--aa-success)' : 'var(--aa-warning)',
                }}
              >
                <div style={{ paddingTop: 4 }}>
                  {r.isCorrect ? (
                    <IconCheckCircle style={{ color: 'var(--aa-success)', width: 30, height: 30 }} />
                  ) : (
                    <IconXCircle style={{ color: 'var(--aa-warning)', width: 30, height: 30 }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 className="aa-card-title">Question {i + 1}</h3>
                  <p className="aa-body-text" style={{ color: 'var(--aa-text)', marginBottom: 12 }}>
                    {r.question}
                  </p>
                  <p className="aa-body-text" style={{ marginBottom: 8, fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--aa-cyan)', fontWeight: 700 }}>You said · </span>
                    {r.answer}
                  </p>
                  <p className="aa-small" style={{ color: 'var(--aa-text-secondary)', margin: 0 }}>
                    {r.feedback}
                  </p>
                </div>
                <div className="aa-result-confidence" style={{ textAlign: 'right', minWidth: 100 }}>
                  <p className="aa-small" style={{ marginBottom: 6 }}>
                    Confidence
                  </p>
                  <p
                    className="aa-stat"
                    style={{
                      fontSize: '1.1rem',
                      color: conf != null ? 'var(--aa-accent)' : 'var(--aa-text-muted)',
                      marginBottom: 8,
                    }}
                  >
                    {conf != null ? `${conf}%` : '—'}
                  </p>
                  {conf != null && (
                    <div className="aa-confidence-bar">
                      <span style={{ width: `${conf}%` }} />
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <p className="aa-body-text" style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 28px' }}>
          Want to keep going? Try another story—or check your progress anytime.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 460, margin: '0 auto' }}>
          <Link to="/learn" className="aa-btn aa-btn-primary aa-btn-block aa-btn-xl">
            Try another story
          </Link>
          <Link to="/progress" className="aa-btn aa-btn-secondary aa-btn-block aa-btn-xl">
            View my progress
          </Link>
          <Link to="/" className="aa-btn aa-btn-secondary aa-btn-block">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
