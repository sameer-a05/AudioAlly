import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import StoryAudioPlayer from './components/StoryAudioPlayer'

function HomePage() {
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || ''

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-10 text-center">
        <h1 className="mb-3 text-5xl font-bold tracking-tight text-slate-100">⚡ Audio Ally</h1>
        <p className="mx-auto max-w-lg text-lg text-slate-400">
          Turn any school topic into a personalized, interactive audio adventure.
          Upload a PDF or type a topic — AI does the rest.
        </p>
      </header>

      <div className="mb-8 flex justify-center gap-3">
        <NavLink to="/story"
          className="rounded-xl bg-violet-600 px-8 py-4 text-xl font-bold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500 hover:shadow-xl">
          🎧 Start Learning
        </NavLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['📄', 'Upload a PDF', 'Drop in a boring textbook chapter and watch it transform.'],
          ['🎤', 'Voice Answers', 'Kids answer questions by speaking — no typing needed.'],
          ['🌿', 'Adaptive', 'Tailored for ADHD, dyslexia, and ESL learners.'],
        ].map(([icon, title, desc]) => (
          <div key={title} className="rounded-2xl border border-violet-500/20 bg-slate-900/70 p-5">
            <p className="mb-2 text-2xl">{icon}</p>
            <h3 className="mb-1 font-semibold text-slate-100">{title}</h3>
            <p className="text-sm text-slate-400">{desc}</p>
          </div>
        ))}
      </div>

      {!elevenLabsApiKey && (
        <p className="mt-8 rounded-lg border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-center text-sm text-amber-100/90">
          Set <code className="text-amber-200">VITE_ELEVENLABS_API_KEY</code> in your{' '}
          <code className="text-amber-200">.env</code> file to enable voice.
        </p>
      )}
    </div>
  )
}

function StoryRoute() {
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || ''
  return <StoryAudioPlayer elevenLabsApiKey={elevenLabsApiKey} />
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 antialiased">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/story" element={<StoryRoute />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
