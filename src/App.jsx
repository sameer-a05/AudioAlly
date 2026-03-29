import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import AudioEngine from './services/AudioEngine'
import StoryAudioPlayer from './components/StoryAudioPlayer'
import AudioPlayer from './components/AudioPlayer'
import MicrophoneRecorder from './components/MicrophoneRecorder'
import VoiceConversation from './components/VoiceConversation'
import VoiceSelector from './components/VoiceSelector'
import { VoiceProvider, useVoice } from './context/VoiceContext'
import { StorySessionProvider } from './context/StorySessionContext'
import HomePage from './pages/HomePage'
import FeaturesPage from './pages/FeaturesPage'
import VoiceSelectorPage from './pages/VoiceSelectorPage'
import StoryPlayerPage from './pages/StoryPlayerPage'
import ResultsPage from './pages/ResultsPage'
import ProgressPage from './pages/ProgressPage'
import LoginRegister from './components/LoginRegister'
import GalaxyAppShell from './components/layout/GalaxyAppShell'

function StoryRoute() {
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || ''
  return <StoryAudioPlayer elevenLabsApiKey={elevenLabsApiKey} />
}

/** Legacy dev hub: mic, voice widget, audio player */
function DevToolsPage() {
  const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || ''
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
  const engine = useMemo(() => new AudioEngine(elevenLabsApiKey), [elevenLabsApiKey])
  const { appliedVoice } = useVoice()

  useEffect(() => {
    engine.setPreferredVoiceKey(appliedVoice)
  }, [engine, appliedVoice])

  return (
    <div className="aa-page aa-page--galaxy aa-page-fade pt-20">
      <div className="aa-container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <VoiceConversation
          engine={engine}
          geminiApiKey={geminiApiKey}
          elevenLabsApiKey={elevenLabsApiKey}
        />
        <div style={{ marginTop: 24 }}>
          <VoiceSelector engine={engine} elevenLabsApiKey={elevenLabsApiKey} />
        </div>
        <div style={{ marginTop: 24 }}>
          <AudioPlayer engine={engine} elevenLabsApiKey={elevenLabsApiKey} />
        </div>
        <div style={{ marginTop: 24 }}>
          <MicrophoneRecorder />
        </div>
      </div>
    </div>
  )
}

function AuthGate({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const navigate = useNavigate()

  const handleAuthSuccess = () => {
    setIsAuthenticated(true)
    navigate('/')
  }

  if (!isAuthenticated) {
    return <LoginRegister onAuthSuccess={handleAuthSuccess} />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <VoiceProvider>
        <StorySessionProvider>
          <AuthGate>
            <GalaxyAppShell>
              <div className="aa-body">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/features" element={<FeaturesPage />} />
                  <Route path="/voices" element={<VoiceSelectorPage />} />
                  <Route path="/learn" element={<StoryPlayerPage />} />
                  <Route path="/results" element={<ResultsPage />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route
                    path="/story"
                    element={
                      <div className="aa-page aa-page--galaxy aa-page-enter pt-20">
                        <StoryRoute />
                      </div>
                    }
                  />
                  <Route path="/pdf-test" element={<StoryPlayerPage />} />
                  <Route path="/dev" element={<DevToolsPage />} />
                </Routes>
              </div>
            </GalaxyAppShell>
          </AuthGate>
        </StorySessionProvider>
      </VoiceProvider>
    </BrowserRouter>
  )
}
