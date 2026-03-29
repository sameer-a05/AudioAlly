import { useState } from 'react'

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
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (data.status === 'success') {
        // Store username in localStorage for use in stats and API calls
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
    <section className="rounded-2xl border border-violet-500/25 bg-slate-900/80 p-6 shadow-xl shadow-violet-950/40 backdrop-blur-sm mt-8 max-w-md mx-auto">
      <h2 className="mb-4 text-xl font-semibold text-slate-100">{mode === 'login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="rounded px-3 py-2 bg-slate-800 text-white border border-slate-700"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="rounded px-3 py-2 bg-slate-800 text-white border border-slate-700"
          required
        />
        <button
          type="submit"
          className="rounded bg-violet-600 px-4 py-2 text-white"
          disabled={loading}
        >
          {loading ? (mode === 'login' ? 'Logging in…' : 'Registering…') : (mode === 'login' ? 'Login' : 'Register')}
        </button>
      </form>
      <div className="mt-4 text-slate-300">
        {mode === 'login' ? (
          <span>Don't have an account? <button className="underline" onClick={() => { setMode('register'); setMessage('') }}>Register</button></span>
        ) : (
          <span>Already have an account? <button className="underline" onClick={() => { setMode('login'); setMessage('') }}>Login</button></span>
        )}
      </div>
      {message && <div className="mt-2 text-fuchsia-400">{message}</div>}
    </section>
  )
}
