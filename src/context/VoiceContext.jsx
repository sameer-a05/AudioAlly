/* eslint-disable react-refresh/only-export-components -- useVoice is intentionally exported with VoiceProvider */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const VoiceContext = createContext(null)

export function VoiceProvider({ children }) {
  const [selectedVoice, setSelectedVoice] = useState('femaleNarrator')
  const [appliedVoice, setAppliedVoice] = useState('femaleNarrator')

  const confirmSelection = useCallback((overrideKey) => {
    if (typeof overrideKey === 'string' && overrideKey) {
      setAppliedVoice(overrideKey)
      return
    }
    setAppliedVoice(selectedVoice)
  }, [selectedVoice])

  const value = useMemo(
    () => ({
      selectedVoice,
      setSelectedVoice,
      appliedVoice,
      setAppliedVoice,
      confirmSelection,
    }),
    [selectedVoice, appliedVoice, confirmSelection],
  )

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
}

export function useVoice() {
  const ctx = useContext(VoiceContext)
  if (!ctx) {
    throw new Error('useVoice must be used within VoiceProvider')
  }
  return ctx
}
