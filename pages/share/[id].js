import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import { getVerticalEmoji } from '@/lib/utils'

export default function SharePage() {
  const { t } = useI18n()
  const router = useRouter()
  const { id } = router.query
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState([])
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data } = await supabase
        .from('agents')
        .select('id, name, description, vertical, config, status')
        .eq('id', id)
        .single()
      if (data && data.status === 'active') setAgent(data)
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function handleSend() {
    if (!input.trim() || running) return
    const userMsg = input.trim()
    setInput('')

    const newMessages = [...messages, { role: 'user', text: userMsg }]
    setMessages(newMessages)
    setRunning(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/v1/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: id,
          user_input: userMsg,
          messages: newMessages,
          stream: true,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let metadata = {}

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'text') {
              fullText += data.text
              setStreamingText(fullText)
            } else if (data.type === 'done') {
              metadata = { tokens: data.tokens_used, ms: data.duration_ms }
            } else if (data.type === 'error') {
              throw new Error(data.error)
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') throw e
          }
        }
      }

      setStreamingText('')
      setMessages((prev) => [...prev, { role: 'agent', text: fullText, tokens: metadata.tokens, ms: metadata.ms }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'error', text: err.message }])
    } finally {
      setRunning(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (loading) return <div className="min-h-dvh bg-cream flex items-center justify-center font-sans"><div className="animate-spin w-8 h-8 border-4 border-terracotta border-t-transparent rounded-full" /></div>

  if (!agent) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center font-sans">
      <div className="text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="font-serif text-2xl font-bold text-forest mb-2">Agent not found</h1>
        <p className="text-gray-400 text-sm">This agent doesn&apos;t exist or isn&apos;t available.</p>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>{agent.name} — CreateAgent.ai</title>
        <meta name="description" content={agent.description} />
      </Head>

      <div className="min-h-dvh bg-cream font-sans flex flex-col">
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
            <a href="https://createagents.ai" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-300 hover:text-terracotta bg-gray-50 px-2 py-1 rounded-full transition-colors">
              Built with CreateAgent.ai
            </a>
          </div>
        </header>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-4 space-y-4">
            {messages.length === 0 && !streamingText && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">{agent.config?.emoji || getVerticalEmoji(agent.vertical)}</div>
                <h2 className="font-serif text-2xl font-bold text-forest mb-2">{t('share_hi')} {agent.name}</h2>
                <p className="text-gray-400 text-sm max-w-md mx-auto mb-4">{agent.description}</p>
                <p className="text-xs text-gray-300">{t('share_memory')}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-terracotta text-white rounded-br-md'
                    : msg.role === 'error' ? 'bg-red-50 text-red-600 rounded-bl-md'
                    : 'bg-white border border-gray-100 text-forest rounded-bl-md'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {msg.tokens && <div className="mt-2 text-[10px] opacity-40">{msg.tokens} tokens · {msg.ms}ms</div>}
                </div>
              </div>
            ))}

            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-white border border-gray-100 text-forest rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed">
                  <div className="whitespace-pre-wrap">{streamingText}</div>
                  <span className="inline-block w-2 h-4 bg-terracotta/40 animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            {running && !streamingText && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-gray-400">
                  <div className="animate-spin w-3.5 h-3.5 border-2 border-terracotta border-t-transparent rounded-full" />
                  Working on it...
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
              placeholder={messages.length > 0 ? 'Continue the conversation...' : `Ask ${agent.name} anything...`}
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
