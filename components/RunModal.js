import { useState } from 'react'

export default function RunModal({ agent, onClose }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleRun() {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agent.id, user_input: input }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Run failed')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl font-bold text-forest">{agent.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Enter your input and run the agent</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-forest mb-2">Your Input</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you need this agent to do..."
              className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none resize-none text-sm"
              disabled={loading}
            />
          </div>

          {loading && (
            <div className="flex items-center gap-3 p-4 bg-cream rounded-xl">
              <div className="animate-spin w-5 h-5 border-2 border-terracotta border-t-transparent rounded-full" />
              <span className="text-sm text-forest">Agent is thinking...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="p-5 bg-forest/5 rounded-xl">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-medium">Output</div>
                <div className="text-sm text-forest whitespace-pre-wrap leading-relaxed">
                  {result.output}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{result.tokens_used} tokens</span>
                <span>{result.duration_ms}ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-forest transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleRun}
            disabled={loading || !input.trim()}
            className="px-6 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Running...' : 'Run Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
