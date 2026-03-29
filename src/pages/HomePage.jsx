import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import MascotCharacter from '../components/MascotCharacter'
import {
  IconBook,
  IconMic,
  IconWaveform,
} from '../components/icons/BrandIcons'

function IconTrophy({ className = '' }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M12 10h24v4c0 6-3.5 11-9 12.5V38h10v4H14v-4h10v-11.5C18.5 25 15 20 15 14v-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M8 10v4c0 3 2 5 5 5M40 10v4c0 3-2 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const FEATURES = [
  {
    Icon: IconBook,
    title: 'Stories that teach',
    desc: 'Your PDF becomes a story you can hear—clear, paced, and built to help ideas stick.',
    accent: 'linear-gradient(135deg, rgba(124, 58, 237, 0.35), rgba(6, 182, 212, 0.2))',
  },
  {
    Icon: IconMic,
    title: 'Speak your answers',
    desc: 'Answer out loud—no typing. Great for focus, confidence, and accessibility.',
    accent: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(124, 58, 237, 0.2))',
  },
  {
    Icon: IconTrophy,
    title: 'Track your progress',
    desc: 'See how you did, read encouraging feedback, and come back stronger next time.',
    accent: 'linear-gradient(135deg, rgba(251, 191, 36, 0.35), rgba(249, 115, 22, 0.2))',
  },
]

export default function HomePage() {
  return (
    <div className="aa-page aa-page-enter">
      <Navigation />

      <section className="aa-hero--kid">
        <div
          className="aa-hero-floater"
          style={{ width: 180, height: 180, background: 'var(--aa-primary)', top: '8%', left: '5%' }}
        />
        <div
          className="aa-hero-floater"
          style={{ width: 120, height: 120, background: 'var(--aa-cyan)', top: '20%', right: '8%' }}
        />
        <div
          className="aa-hero-floater"
          style={{ width: 80, height: 80, background: 'var(--aa-accent)', bottom: '15%', left: '15%' }}
        />
        <div className="aa-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="aa-hero-split">
            <div>
              <p
                className="aa-small"
                style={{
                  color: 'var(--aa-cyan)',
                  marginBottom: 12,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                }}
              >
                Let&apos;s go — your adventure starts here
              </p>
              <h1 className="aa-display">Learn Anything Through Stories</h1>
              <p
                className="aa-body-text"
                style={{
                  fontSize: 'clamp(1.0625rem, 2vw, 1.2rem)',
                  maxWidth: '36rem',
                  marginTop: 20,
                  marginBottom: 36,
                }}
              >
                Listen, answer, and grow smarter every day. Pick a voice, upload a PDF, and learn the fun
                way—without the noise.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                <Link to="/learn" className="aa-btn aa-btn-primary aa-btn-xl">
                  Start your adventure
                </Link>
                <Link to="/voices" className="aa-btn aa-btn-secondary aa-btn-xl">
                  Pick a narrator
                </Link>
              </div>
            </div>
            <div
              className="aa-float-slow"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}
            >
              <MascotCharacter mood="wave" size={220} />
              <p className="aa-small" style={{ textAlign: 'center', maxWidth: 280 }}>
                Hi! I&apos;m Ally. I&apos;ll cheer you on and keep things clear.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="aa-container" style={{ paddingBottom: 88 }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
          <h2 className="aa-subhead" style={{ fontSize: 'clamp(1.35rem, 2.8vw, 1.75rem)' }}>
            How Audio Ally works
          </h2>
          <p className="aa-body-text" style={{ marginTop: 12 }}>
            Big buttons, generous spacing, and voices that feel friendly—so you can focus on learning.
          </p>
        </div>
        <div className="aa-feature-grid">
          {FEATURES.map((feature, i) => {
            const IconComponent = feature.Icon
            return (
              <article
                key={feature.title}
                className="aa-card aa-card-interactive aa-stagger-item"
                style={{
                  '--stagger-delay': `${i * 100}ms`,
                  borderRadius: 'var(--aa-radius-playful)',
                  borderTop: '4px solid #7c3aed',
                }}
              >
                <div
                  style={{
                    borderRadius: 16,
                    padding: '14px',
                    marginBottom: 18,
                    background: feature.accent,
                    width: 'fit-content',
                  }}
                >
                  <div style={{ color: 'var(--aa-primary)' }}>
                    <IconComponent />
                  </div>
                </div>
                <h3 className="aa-card-title" style={{ fontSize: '1.2rem' }}>
                  {feature.title}
                </h3>
                <p className="aa-body-text" style={{ fontSize: '0.9375rem', margin: 0 }}>
                  {feature.desc}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="aa-container" style={{ paddingBottom: 88 }}>
        <div
          className="aa-card"
          style={{
            textAlign: 'center',
            maxWidth: 760,
            margin: '0 auto',
            borderRadius: 'var(--aa-radius-playful)',
            background: 'linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1px solid rgba(124, 58, 237, 0.25)',
          }}
        >
          <IconWaveform style={{ color: 'var(--aa-cyan)', marginBottom: 12 }} />
          <p className="aa-stat" style={{ marginBottom: 8, fontSize: '1.125rem', color: 'var(--aa-accent)' }}>
            1M+ lessons completed
          </p>
          <p className="aa-body-text" style={{ fontStyle: 'italic', maxWidth: 520, margin: '0 auto' }}>
            Students say it feels less like homework and more like a game they actually want to finish.
          </p>
        </div>
      </section>

      <footer className="aa-footer">
        <div className="aa-footer-inner">
          <span className="aa-small" style={{ color: 'var(--aa-text-muted)' }}>
            © {new Date().getFullYear()} Audio Ally
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            <Link to="/voices" className="aa-link" style={{ border: 'none', fontSize: '0.875rem' }}>
              Voices
            </Link>
            <Link to="/learn" className="aa-link" style={{ border: 'none', fontSize: '0.875rem' }}>
              Learn
            </Link>
            <Link to="/progress" className="aa-link" style={{ border: 'none', fontSize: '0.875rem' }}>
              Progress
            </Link>
            <Link to="/story" className="aa-link" style={{ border: 'none', fontSize: '0.875rem' }}>
              Story mode
            </Link>
            <Link to="/dev" className="aa-link" style={{ border: 'none', fontSize: '0.875rem' }}>
              Developers
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
