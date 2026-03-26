import { useState, useRef, useEffect } from 'react'

/**
 * Floating help chatbot — appears on every page.
 * Uses the /api/chat RAG endpoint to answer questions about the platform.
 * This is how Bilal (or any user) gets unstuck.
 */
export default function HelpChat({ user }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function handleSend() {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    setStreaming('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          messages: messages,
          vertical: 'platform',
          persona: 'user-help',
          task: 'help',
          user_id: user?.id,
        }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'text') {
              fullText += data.text
              setStreaming(fullText)
            }
          } catch {}
        }
      }

      setStreaming('')
      setMessages((prev) => [...prev, { role: 'assistant', text: fullText }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }])
    }
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const [showNudge, setShowNudge] = useState(false)

  // Show nudge after 3 seconds on first visit
  useEffect(() => {
    const seen = localStorage.getItem('zara_nudge_seen')
    if (!seen && !open) {
      const timer = setTimeout(() => setShowNudge(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [open])

  function handleOpen() {
    setOpen(!open)
    setShowNudge(false)
    localStorage.setItem('zara_nudge_seen', '1')
  }

  return (
    <>
      {/* Nudge tooltip */}
      {showNudge && !open && (
        <div className="fixed bottom-24 right-6 z-[91] animate-slide-up">
          <div className="bg-forest text-cream px-4 py-3 rounded-xl shadow-lg max-w-[240px] text-sm relative">
            <button onClick={() => { setShowNudge(false); localStorage.setItem('zara_nudge_seen', '1') }} className="absolute top-1 right-2 text-cream/40 hover:text-cream text-xs">✕</button>
            <p className="font-medium mb-0.5">Need guidance? Talk to Zara ✦</p>
            <p className="text-xs text-cream/70">I&apos;m your AI guide — tap the button below to get help anytime.</p>
            <div className="absolute bottom-0 right-8 translate-y-1/2 w-3 h-3 bg-forest rotate-45" />
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full bg-terracotta text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center text-2xl"
        title="Talk to Zara — your AI guide"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[90] w-[360px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-forest text-cream px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center text-sm">✦</div>
            <div>
              <div className="text-sm font-medium">Zara — Your AI Guide</div>
              <div className="text-[10px] text-cream/60">I&apos;m here to help you every step of the way</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !streaming && (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">✦</div>
                <p className="text-sm text-forest font-medium mb-1">Hi! I&apos;m Zara, your AI guide</p>
                <p className="text-xs text-gray-400 mb-4">Ask me anything — I&apos;ll walk you through it step by step</p>
                <div className="space-y-2">
                  {['How do I build my first agent?', 'What are the pricing plans?', 'How do I share my agent?'].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); setTimeout(handleSend, 100) }}
                      className="block w-full text-left px-3 py-2 bg-cream rounded-lg text-xs text-forest hover:bg-terracotta/5 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-terracotta text-white rounded-br-sm'
                    : 'bg-cream text-forest rounded-bl-sm'
                }`}>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-cream text-forest rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                  <div className="whitespace-pre-wrap">{streaming}</div>
                  <span className="inline-block w-1.5 h-3 bg-terracotta/40 animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {loading && !streaming && (
              <div className="flex justify-start">
                <div className="bg-cream rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-2">
                  <div className="animate-spin w-3 h-3 border-2 border-terracotta border-t-transparent rounded-full" />
                  <span className="text-xs text-gray-400">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-terracotta"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-terracotta text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
