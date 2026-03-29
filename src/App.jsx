import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { useMemo } from 'react'
import AudioEngine from './services/AudioEngine'
import AudioPlayer from './components/AudioPlayer'
import MicrophoneRecorder from './components/MicrophoneRecorder'
import StoryAudioPlayer from './components/StoryAudioPlayer'
import PdfUploadWithStory from './components/PdfUploadWithStory'

function HomePage() {
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || ''
  const engine = useMemo(() => new AudioEngine(elevenLabsApiKey), [elevenLabsApiKey])

  async function handleTestAudioEngine() {
    console.log('🎬 Test Audio Engine — start')
    try {
      if (!elevenLabsApiKey) {
        console.log('❌ No VITE_ELEVENLABS_API_KEY in .env')
        return
      }
      console.log('🔑 API key loaded (length):', elevenLabsApiKey.length)
      console.log('🔊 generateSpeech("Hello world") …')
      const audioUrl = await engine.generateSpeech('Hello world')
      console.log('✅ TTS blob URL:', audioUrl)
      console.log('▶️ playAudio …')
      await engine.playAudio(audioUrl)
      console.log('🏁 Playback finished')
    } catch (e) {
      console.log('❌ Error:', e?.message || e)
    }
  }

  const tabClass = ({ isActive }) =>
    `rounded-xl px-5 py-2.5 text-base font-semibold transition ${
      isActive
        ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
        : 'border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-violet-500/40 hover:text-violet-100'
    }`

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-20">
      <header className="mb-10 border-b border-violet-500/25 pb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">
          Audio Ally
        </h1>
        <p className="mb-8 max-w-xl text-lg leading-relaxed text-slate-400">
          Educational story audio: ElevenLabs TTS, playback controls, mic + speech recognition,
          and story routes.
        </p>

        <nav className="mb-6 flex flex-wrap gap-3" aria-label="Main">
          <NavLink to="/" end className={tabClass}>
            Home
          </NavLink>
          <NavLink to="/story" className={tabClass}>
            Story player
          </NavLink>
        </nav>

        <button
          type="button"
          onClick={handleTestAudioEngine}
          className="rounded-xl bg-fuchsia-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-fuchsia-950/50 transition hover:bg-fuchsia-500"
        >
          Test Audio Engine
        </button>
      </header>

      <div className="flex flex-col gap-8">
        <AudioPlayer engine={engine} elevenLabsApiKey={elevenLabsApiKey} />
        <MicrophoneRecorder />

        <section className="rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl shadow-violet-950/40 backdrop-blur-sm">
          <h2 className="mb-2 text-xl font-semibold text-slate-100">Story route</h2>
          <p className="mb-5 text-sm leading-relaxed text-slate-400">
            Open the full story player with sample segments and question pauses.
          </p>
          <Link
            to="/story"
            className="inline-flex rounded-xl bg-violet-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500"
          >
            Open story player
          </Link>
        </section>

        <PdfUploadWithStory />
      </div>
    </div>
  )
}

import { useLocation } from 'react-router-dom'
function StoryRoute() {
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || ''
  const location = useLocation();
  const story = location.state?.story || null;
  return <StoryAudioPlayer elevenLabsApiKey={elevenLabsApiKey} story={story} />
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
