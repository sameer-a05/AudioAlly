/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

function randomId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const StorySessionContext = createContext(null)

export function StorySessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(() => randomId())
  const [storyId, setStoryId] = useState(null)
  const [childId] = useState(() => {
    if (typeof localStorage === 'undefined') return `child_${randomId()}`
    let id = localStorage.getItem('audioally_child_id')
    if (!id) {
      id = `child_${randomId()}`
      localStorage.setItem('audioally_child_id', id)
    }
    return id
  })
  const [startTime, setStartTime] = useState(null)
  const [endTime, setEndTime] = useState(null)
  const [answers, setAnswers] = useState([])
  const [completed, setCompleted] = useState(false)

  const startSession = useCallback((newStoryId) => {
    setSessionId(randomId())
    setStoryId(newStoryId || null)
    setStartTime(Date.now())
    setEndTime(null)
    setAnswers([])
    setCompleted(false)
    console.log('📝 Session started:', newStoryId)
  }, [])

  const recordAnswer = useCallback((entry) => {
    setAnswers((prev) => {
      const next = [...prev, { ...entry, timestamp: entry.timestamp ?? Date.now() }]
      console.log('📝 Answer recorded:', entry.segmentId, entry.isCorrect)
      return next
    })
  }, [])

  const completeSession = useCallback(() => {
    setEndTime(Date.now())
    setCompleted(true)
    console.log('🎉 Session completed')
  }, [])

  const score = useMemo(() => {
    const graded = answers.filter((a) => typeof a.isCorrect === 'boolean')
    const correct = answers.filter((a) => a.isCorrect === true).length
    return {
      correct,
      total: graded.length,
      fraction: graded.length ? `${correct}/${graded.length}` : '0/0',
    }
  }, [answers])

  const value = useMemo(
    () => ({
      sessionId,
      storyId,
      childId,
      startTime,
      endTime,
      answers,
      completed,
      score,
      startSession,
      recordAnswer,
      completeSession,
      setStoryId,
    }),
    [
      sessionId,
      storyId,
      childId,
      startTime,
      endTime,
      answers,
      completed,
      score,
      startSession,
      recordAnswer,
      completeSession,
    ],
  )

  return (
    <StorySessionContext.Provider value={value}>
      {children}
    </StorySessionContext.Provider>
  )
}

export function useStorySession() {
  const ctx = useContext(StorySessionContext)
  if (!ctx) {
    throw new Error('useStorySession must be used within StorySessionProvider')
  }
  return ctx
}
