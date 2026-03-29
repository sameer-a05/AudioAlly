import { useState } from 'react'
import { InteractiveRobotSpline } from './ui/interactive-3d-robot.jsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card.jsx'

const ROBOT_SCENE =
  'https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode'

export default function LoginRegister({ onAuthSuccess }) {
  const [mode, setMode] = useState('login') // 'login' or 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const endpoint = mode === 'login' ? '/api/login' : '/api/register'
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        if (data.username) {
          localStorage.setItem('username', data.username)
        }
        setMessage(mode === 'login' ? 'Login successful!' : 'Registration successful!')
        setTimeout(() => {
          if (onAuthSuccess) onAuthSuccess()
        }, 500)
      } else {
        setMessage(data.detail || 'Error')
      }
    } catch (err) {
      setMessage('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="flex min-h-screen w-full flex-col bg-slate-950 md:h-screen md:flex-row md:overflow-hidden">
      {/* Robot: full viewport on mobile; full height + half width on md+ (entire left half of the screen) */}
      <div className="relative h-screen w-full shrink-0 md:h-full md:min-h-0 md:w-1/2 md:flex-1">
        <InteractiveRobotSpline
          scene={ROBOT_SCENE}
          className="absolute inset-0 h-full w-full"
        />
      </div>

      {/* Form: below the robot on mobile (scroll); right column on md - never layered on the canvas */}
      <div className="flex w-full flex-1 flex-col justify-center border-t border-violet-500/25 bg-slate-950 px-6 py-12 md:w-1/2 md:border-t-0 md:border-l md:py-12">
        <Card className="mx-auto w-full max-w-md border-violet-500/30">
          <CardHeader className="pb-2">
            <CardTitle>{mode === 'login' ? 'Login' : 'Register'}</CardTitle>
            <CardDescription className="text-slate-400">
              {mode === 'login'
                ? 'Welcome back. Sign in to continue.'
                : 'Create an account to save your progress.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800/90 px-3 py-2 text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                required
                autoComplete="username"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800/90 px-3 py-2 text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white transition hover:bg-violet-500 disabled:opacity-60"
                disabled={loading}
              >
                {loading
                  ? mode === 'login'
                    ? 'Logging in…'
                    : 'Registering…'
                  : mode === 'login'
                    ? 'Login'
                    : 'Register'}
              </button>
            </form>
            <div className="text-center text-sm text-slate-300">
              {mode === 'login' ? (
                <span>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="font-medium text-violet-300 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-200"
                    onClick={() => {
                      setMode('register')
                      setMessage('')
                    }}
                  >
                    Register
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="font-medium text-violet-300 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-200"
                    onClick={() => {
                      setMode('login')
                      setMessage('')
                    }}
                  >
                    Login
                  </button>
                </span>
              )}
            </div>
            {message && (
              <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/40 px-3 py-2 text-center text-sm text-fuchsia-200">
                {message}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
