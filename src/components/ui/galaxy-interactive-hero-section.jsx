import { useEffect, useRef, useState, Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, PlayCircle, Sparkles } from 'lucide-react'

const Spline = lazy(() => import('@splinetool/react-spline'))

const SPLINE_SCENE =
  'https://prod.spline.design/us3ALejTXl6usHZ7/scene.splinecode'

export function GalaxySplineBackground() {
  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden">
      <Suspense
        fallback={
          <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
            Loading scene…
          </div>
        }
      >
        <Spline
          style={{ width: '100%', height: '100%', minHeight: '100vh', pointerEvents: 'none' }}
          scene={SPLINE_SCENE}
        />
      </Suspense>
      <div
        className="pointer-events-none absolute inset-0 min-h-screen w-full"
        style={{
          background: `linear-gradient(to right, rgba(0, 0, 0, 0.8), transparent 30%, transparent 70%, rgba(0, 0, 0, 0.8)), linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.9))`,
        }}
      />
    </div>
  )
}

const btnPrimary =
  'flex w-full items-center justify-center rounded-full border border-[#322D36] bg-[#8200DB29] px-6 py-2 font-semibold text-white transition duration-300 hover:bg-[#8200DB50] sm:w-auto sm:py-3 sm:px-8'
const btnGhost =
  'flex w-full items-center justify-center rounded-full border border-gray-600 bg-[#0009] px-6 py-2 font-medium text-gray-200 transition duration-300 hover:border-gray-400 hover:text-white sm:w-auto sm:py-3 sm:px-8'

function HeroContent() {
  return (
    <div className="max-w-3xl px-4 pt-16 text-left text-white sm:pt-24 md:pt-32">
      <h1 className="mb-4 text-3xl font-bold leading-tight tracking-wide sm:text-5xl md:text-7xl">
        Transform reading <br className="sm:hidden" />
        into an interactive
        <br className="sm:hidden" /> audio journey.
      </h1>
      <p className="mb-6 max-w-xl text-base opacity-80 sm:mb-8 sm:text-lg md:text-xl">
        Upload your PDFs and let AudioAlly bring them to life with AI-driven voice
        actors, interactive Q&amp;A, and personalized learning paths.
      </p>
      <div className="pointer-events-auto flex flex-col items-start space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
        <Link
          to="/learn"
          className={btnPrimary}
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <Sparkles className="mr-2 h-5 w-5" /> Start Learning
        </Link>
        <Link to="/story" className={btnGhost}>
          <PlayCircle className="mr-2 h-5 w-5" /> Watch Demo
        </Link>
      </div>
    </div>
  )
}

export function GalaxyNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((open) => !open)
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileMenuOpen])

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-20 rounded-b-[15px]"
      style={{
        backgroundColor: 'rgba(13, 13, 24, 0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center space-x-6 lg:space-x-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold tracking-wider text-white"
          >
            <Sparkles className="text-[#8200DB]" /> AudioAlly
          </Link>
          <div className="hidden items-center space-x-6 text-sm text-gray-300 lg:flex">
            <Link to="/features" className="transition hover:text-white">
              Features
            </Link>
            <Link to="/voices" className="transition hover:text-white">
              Voices
            </Link>
          </div>
        </div>
        <div className="flex items-center space-x-4 md:space-x-6">
          <Link
            to="/progress"
            className="hidden text-sm text-gray-300 hover:text-white sm:block"
          >
            Progress
          </Link>
          <Link
            to="/learn"
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#322D36] bg-[#8200DB29] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#8200DB50]"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            Start learning
          </Link>
          <button
            type="button"
            className="p-2 text-white lg:hidden"
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
      {isMobileMenuOpen && (
        <div className="border-t border-white/10 px-4 pb-4 lg:hidden">
          <div className="flex flex-col gap-1 pt-2 text-sm text-gray-300">
            <Link
              to="/features"
              className="rounded-lg py-2 hover:bg-white/5 hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              to="/voices"
              className="rounded-lg py-2 hover:bg-white/5 hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Voices
            </Link>
            <Link
              to="/progress"
              className="rounded-lg py-2 hover:bg-white/5 hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Progress
            </Link>
            <Link
              to="/learn"
              className="inline-flex items-center gap-2 rounded-lg py-2 font-semibold text-white hover:bg-white/5"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              Start learning
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

export const HeroSection = () => {
  const heroContentRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => {
      if (!heroContentRef.current) return
      requestAnimationFrame(() => {
        const scrollPosition = window.scrollY
        const opacity = 1 - Math.min(scrollPosition / 400, 1)
        heroContentRef.current.style.opacity = String(opacity)
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      <div
        ref={heroContentRef}
        className="pointer-events-none absolute left-0 top-0 z-10 flex w-full items-center justify-start"
        style={{ height: '100vh' }}
      >
        <div className="container mx-auto">
          <HeroContent />
        </div>
      </div>
    </div>
  )
}
