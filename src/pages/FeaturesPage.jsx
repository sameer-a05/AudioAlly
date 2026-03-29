import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import FeatureCard from '../components/ui/feature-card.jsx'

const FEATURES = [
  {
    tag: 'Stories',
    title: 'Stories that teach',
    description:
      'Your PDF becomes a story you can hear, clear, paced, and built to help ideas stick.',
    actionText: 'Start learning',
    imageSrc:
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop',
  },
  {
    tag: 'Voice',
    title: 'Speak your answers',
    description:
      'Answer out loud. No typing. Great for focus, confidence, and accessibility.',
    actionText: 'Try voices',
    imageSrc:
      'https://images.unsplash.com/photo-1478737270239-0f8b80d8ea6c?q=80&w=800&auto=format&fit=crop',
  },
  {
    tag: 'Progress',
    title: 'Track your progress',
    description:
      'See how you did, read encouraging feedback, and come back stronger next time.',
    actionText: 'View progress',
    imageSrc:
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=800&auto=format&fit=crop',
  },
]

export default function FeaturesPage() {
  return (
    <div className="aa-page aa-page--galaxy aa-page-enter pt-20">
      <section className="aa-container" style={{ paddingTop: 24, paddingBottom: 88 }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
          <p className="aa-small" style={{ color: 'var(--aa-cyan)', marginBottom: 8, fontWeight: 600 }}>
            Features
          </p>
          <h1 className="aa-display" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)' }}>
            How Audio Ally works
          </h1>
          <p className="aa-body-text" style={{ marginTop: 12 }}>
            Big buttons, generous spacing, and voices that feel friendly, so you can focus on learning.
          </p>
        </div>
        <div className="aa-feature-grid items-stretch">
          {FEATURES.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              tag={feature.tag}
              title={feature.title}
              description={feature.description}
              actionText={feature.actionText}
              imageSrc={feature.imageSrc}
              actionTo={i === 0 ? '/learn' : i === 1 ? '/voices' : '/progress'}
              staggerDelayMs={i * 100}
              actionLeadingIcon={i === 0 ? 'sparkles' : undefined}
            />
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link to="/learn" className="aa-btn aa-btn-primary aa-btn-xl">
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            Start learning
          </Link>
          <Link to="/" className="aa-btn aa-btn-secondary aa-btn-xl">
            Back to home
          </Link>
        </div>
      </section>
    </div>
  )
}
