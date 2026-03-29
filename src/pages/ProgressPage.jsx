
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
export default function ProgressPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Use real username from localStorage only
  const username = localStorage.getItem('username')

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/user-stats/${username}`)
        if (!res.ok) throw new Error('Failed to fetch stats')
        const data = await res.json()
        setStats(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [username])

  return (
    <div className="aa-page aa-page--galaxy aa-page-enter pt-20">
      <div className="aa-container" style={{ paddingTop: 40, paddingBottom: 64, textAlign: 'center' }}>
        <h1 className="aa-display" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', marginBottom: 16 }}>
          My progress
        </h1>
        <div className="aa-card" style={{ maxWidth: 520, margin: '0 auto 32px', textAlign: 'left' }}>
          {loading ? (
            <p className="aa-body-text">Loading stats…</p>
          ) : error ? (
            <p className="aa-body-text" style={{ color: 'red' }}>Error: {error}</p>
          ) : stats ? (
            <>
              <p className="aa-body-text" style={{ margin: 0, fontWeight: 500 }}>User: <b>{stats.username}</b></p>
              <ul style={{ margin: '16px 0 0 0', padding: 0, listStyle: 'none' }}>
                <li>Stories generated: <b>{stats.stories_generated}</b></li>
                <li>Good answers: <b>{stats.good_answers}</b></li>
                <li>Bad answers: <b>{stats.bad_answers}</b></li>
                <li>Unclear answers: <b>{stats.unclear_answers}</b></li>
              </ul>
            </>
          ) : (
            <p className="aa-body-text">No stats found.</p>
          )}
        </div>
        <Link to="/learn" className="aa-btn aa-btn-primary">
          Start a story
        </Link>
      </div>
    </div>
  )
}
