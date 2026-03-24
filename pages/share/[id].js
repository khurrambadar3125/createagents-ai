import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'
import { getVerticalEmoji, getVerticalLabel } from '@/lib/utils'

export default function SharePage() {
  const router = useRouter()
  const { id } = router.query
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data } = await supabase
        .from('agents')
        .select('id, name, description, vertical, config, status')
        .eq('id', id)
        .single()
      if (data && data.status === 'active') {
        setAgent(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || running) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    setRunning(true)

    try {
      const res = await fetch('/api/v1/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: id, user_input: userMsg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setMessages((prev) => [...prev, { role: 'agent', text: data.output, tokens: data.tokens_used, ms: data.duration_ms }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'error', text: err.message }])
    } finally {
      setRunning(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center font-sans">
        <div className="animate-spin w-8 h-8 border-4 border-terracotta border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="font-serif text-2xl font-bold text-forest mb-2">Agent not found</h1>
          <p className="text-gray-400 text-sm">This agent doesn&apos;t exist or isn&apos;t available.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{agent.name} — CreateAgent.ai</title>
        <meta name="description" content={agent.description} />
      </Head>

      <div className="min-h-screen bg-cream font-sans flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest/5 flex items-center justify-center text-lg">
              {agent.config?.emoji || getVerticalEmoji(agent.vertical)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg font-bold text-forest truncate">{agent.name}</h1>
              <p className="text-xs text-gray-400 truncate">{agent.description}</p>
            </div>
            <a
              href="https://createagents.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gray-300 hover:text-terracotta bg-gray-50 px-2 py-1 rounded-full transition-colors"
            >
              Built with CreateAgent.ai
            </a>
          </div>
        </header>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-4 space-y-4">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">{agent.config?.emoji || getVerticalEmoji(agent.vertical)}</div>
                <h2 className="font-serif text-2xl font-bold text-forest mb-2">Hi! I&apos;m {agent.name}</h2>
                <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">{agent.description}</p>
                {agent.config?.use_case && (
                  <p className="text-xs text-terracotta/60 italic">&quot;{agent.config.use_case}&quot;</p>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-terracotta text-white rounded-br-md'
                      : msg.role === 'error'
                      ? 'bg-red-50 text-red-600 rounded-bl-md'
                      : 'bg-white border border-gray-100 text-forest rounded-bl-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {msg.tokens && (
                    <div className="mt-2 text-[10px] opacity-50">
                      {msg.tokens} tokens · {msg.ms}ms
                    </div>
                  )}
                </div>
              </div>
            ))}

            {running && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-terracotta border-t-transparent rounded-full" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-100 p-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${agent.name} anything...`}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm resize-none"
              rows={1}
              disabled={running}
            />
            <button
              onClick={handleSend}
              disabled={running || !input.trim()}
              className="px-5 py-3 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-all"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
