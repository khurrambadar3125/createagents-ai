import { useCallback, useEffect, useState } from 'react'

/**
 * Hook that tracks user actions and provides smart suggestions.
 * Fires on every significant action — the platform learns autonomously.
 */
export function useLearn(userId) {
  const [suggestions, setSuggestions] = useState([])

  // Track an event — fire-and-forget
  const track = useCallback((event, metadata = {}) => {
    if (!event) return
    fetch('/api/learn/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, event, metadata }),
    }).catch(() => {})
  }, [userId])

  // Load suggestions
  const loadSuggestions = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/learn/suggestions?user_id=${userId}`)
      const data = await res.json()
      setSuggestions(Array.isArray(data) ? data : [])
    } catch {
      setSuggestions([])
    }
  }, [userId])

  // Auto-track page views and load suggestions
  useEffect(() => {
    if (!userId) return
    track('page_view', { path: window.location.pathname })
    loadSuggestions()
  }, [userId, track, loadSuggestions])

  return { track, suggestions, refreshSuggestions: loadSuggestions }
}
