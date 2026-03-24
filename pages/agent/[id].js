import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '@/components/Layout'
import withAuth from '@/lib/withAuth'
import { supabase } from '@/lib/supabase'
import { getVerticalEmoji, getVerticalLabel, formatDate, statusColor } from '@/lib/utils'

function AgentPage({ user, profile }) {
  const router = useRouter()
  const { id } = router.query
  const [agent, setAgent] = useState(null)
  const [runs, setRuns] = useState([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState([])
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('chat') // chat | history | deploy | config
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!id) return
    async function load() {
      const [agentRes, runsRes] = await Promise.all([
        supabase.from('agents').select('*').eq('id', id).eq('owner_id', user.id).single(),
        supabase.from('agent_runs').select('*').eq('agent_id', id).order('started_at', { ascending: false }).limit(20),
      ])
      if (!agentRes.data) { router.push('/dashboard'); return }
      setAgent(agentRes.data)
      setEditName(agentRes.data.name)
      setEditDesc(agentRes.data.description)
      setRuns(runsRes.data || [])
      setLoading(false)
    }
    load()
  }, [id, user.id, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function handleSend() {
    if (!input.trim() || running) return
    const userMsg = input.trim()
    setInput('')
    setError(null)

    const newMessages = [...messages, { role: 'user', text: userMsg }]
    setMessages(newMessages)
    setRunning(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/agents/run', {
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
        if (data.error === 'limit_reached') {
          setError(`You've used all your runs (${data.runs_used}/${data.runs_limit}). Upgrade to continue.`)
        } else {
          throw new Error(data.error || 'Something went wrong')
        }
        setRunning(false)
        return
      }

      // Read streaming response
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
      setMessages((prev) => [...prev, {
        role: 'agent',
        text: fullText,
        tokens: metadata.tokens,
        ms: metadata.ms,
      }])

      // Refresh run history
      const { data: newRuns } = await supabase
        .from('agent_runs').select('*').eq('agent_id', id)
        .order('started_at', { ascending: false }).limit(20)
      setRuns(newRuns || [])
    } catch (err) {
      setError(err.message)
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

  function handleCopy(text) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    await supabase.from('agents').update({ name: editName, description: editDesc }).eq('id', id)
    setAgent({ ...agent, name: editName, description: editDesc })
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this agent? This cannot be undone.')) return
    await supabase.from('agents').delete().eq('id', id)
    router.push('/dashboard')
  }

  function handleNewChat() {
    setMessages([])
    setStreamingText('')
    setError(null)
  }

  if (loading) {
    return (
      <Layout user={user} profile={profile}>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-terracotta border-t-transparent rounded-full" />
        </div>
      </Layout>
    )
  }

  const config = agent.config || {}
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://createagents.ai'

  return (
    <Layout user={user} profile={profile}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cream flex items-center justify-center text-2xl">
              {config.emoji || getVerticalEmoji(agent.vertical)}
            </div>
            <div>
              {editing ? (
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="font-serif text-2xl font-bold text-forest border-b border-terracotta outline-none bg-transparent" />
              ) : (
                <h1 className="font-serif text-2xl font-bold text-forest">{agent.name}</h1>
              )}
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400 flex-wrap">
                <span>{getVerticalLabel(agent.vertical)}</span>
                <span>·</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(agent.status)}`}>{agent.status}</span>
                <span>·</span>
                <span>{agent.run_count || 0} runs</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={handleSave} className="px-4 py-2 bg-forest text-white rounded-xl text-sm">Save</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50">Edit</button>
                <button onClick={handleDelete} className="px-3 py-2 border border-red-200 rounded-xl text-xs text-red-500 hover:bg-red-50">Delete</button>
              </>
            )}
          </div>
        </div>

        {editing && (
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full h-20 px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:border-terracotta" />
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { key: 'chat', label: 'Chat' },
            { key: 'history', label: 'History' },
            { key: 'deploy', label: 'Use Anywhere' },
            { key: 'config', label: 'Settings' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white text-forest shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* CHAT TAB */}
        {tab === 'chat' && (
          <div className="bg-white rounded-2xl border border-gray-100 flex flex-col" style={{ height: '60vh' }}>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && !streamingText && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">{config.emoji || getVerticalEmoji(agent.vertical)}</div>
                  <h2 className="font-serif text-xl font-bold text-forest mb-2">{agent.name}</h2>
                  <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">{agent.description}</p>
                  {config.use_case && (
                    <p className="text-xs text-terracotta/60 italic mb-6">&quot;{config.use_case}&quot;</p>
                  )}
                  <p className="text-xs text-gray-300">Type a message below to get started. I&apos;ll remember our whole conversation.</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-terracotta text-white rounded-br-md'
                      : 'bg-cream text-forest rounded-bl-md'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    {msg.role === 'agent' && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-black/5">
                        <span className="text-[10px] opacity-40">{msg.tokens} tokens · {msg.ms}ms</span>
                        <button onClick={() => handleCopy(msg.text)} className="text-[10px] opacity-40 hover:opacity-70">
                          {copied ? '✓' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming output */}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-cream text-forest rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed">
                    <div className="whitespace-pre-wrap">{streamingText}</div>
                    <div className="mt-1">
                      <span className="inline-block w-2 h-4 bg-terracotta/40 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {running && !streamingText && (
                <div className="flex justify-start">
                  <div className="bg-cream rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-gray-400">
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-terracotta border-t-transparent rounded-full" />
                    Working on it...
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="bg-red-50 text-red-600 rounded-xl px-4 py-2 text-sm">
                    {error}
                    {error.includes('runs') && (
                      <Link href="/pricing" className="block mt-1 text-red-700 underline text-xs">Upgrade your plan →</Link>
                    )}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                {messages.length > 0 && (
                  <button onClick={handleNewChat} className="text-xs text-gray-400 hover:text-forest transition-colors">
                    + New chat
                  </button>
                )}
                <span className="text-[10px] text-gray-300 ml-auto">
                  {messages.length > 0 && `${messages.length} messages · `}Agent remembers this conversation
                </span>
              </div>
              <div className="flex gap-3">
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
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div>
            {runs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="text-3xl mb-3">📭</div>
                <p className="text-sm text-gray-400">No runs yet. Start a chat to see history here.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Status</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Input</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider hidden md:table-cell">Tokens</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(run.status)}`}>{run.status}</span></td>
                        <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{run.input?.text || '—'}</td>
                        <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{run.tokens_used || '—'}</td>
                        <td className="px-5 py-3 text-gray-400">{formatDate(run.started_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* DEPLOY TAB */}
        {tab === 'deploy' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Share Link */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-2xl mb-2">🔗</div>
              <h3 className="font-serif text-sm font-bold text-forest mb-1">Share Link</h3>
              <p className="text-xs text-gray-400 mb-3">Anyone with this link can chat with your agent — no sign-up needed.</p>
              <div className="flex gap-2">
                <input readOnly value={`${siteUrl}/share/${id}`} className="flex-1 px-3 py-2 bg-cream rounded-lg text-xs text-forest truncate outline-none" />
                <button onClick={() => handleCopy(`${siteUrl}/share/${id}`)} className="px-3 py-2 bg-forest text-cream rounded-lg text-xs font-medium hover:bg-forest/90">{copied ? '✓' : 'Copy'}</button>
              </div>
              <a href={`/share/${id}`} target="_blank" rel="noopener noreferrer" className="block mt-3 text-xs text-terracotta hover:underline">Open in new tab →</a>
            </div>

            {/* API */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-serif text-sm font-bold text-forest mb-1">API Endpoint</h3>
              <p className="text-xs text-gray-400 mb-3">Call your agent from any app, website, or tool like Zapier.</p>
              <div className="bg-forest/5 rounded-lg p-3 text-xs font-mono text-forest overflow-x-auto">
                <div className="text-gray-400 mb-1">POST /api/v1/run</div>
                <div className="whitespace-pre">{`{
  "agent_id": "${id}",
  "user_input": "your message"
}`}</div>
              </div>
              <button onClick={() => handleCopy(`curl -X POST ${siteUrl}/api/v1/run -H "Content-Type: application/json" -d '{"agent_id":"${id}","user_input":"Hello"}'`)} className="mt-3 text-xs text-terracotta hover:underline">Copy cURL command</button>
            </div>

            {/* Embed */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-2xl mb-2">📦</div>
              <h3 className="font-serif text-sm font-bold text-forest mb-1">Embed on Website</h3>
              <p className="text-xs text-gray-400 mb-3">Add a chat bubble to any website with one line of code.</p>
              <div className="bg-forest/5 rounded-lg p-3 text-xs font-mono text-forest break-all">
                {`<script src="${siteUrl}/embed.js" data-agent-id="${id}"></script>`}
              </div>
              <button onClick={() => handleCopy(`<script src="${siteUrl}/embed.js" data-agent-id="${id}"></script>`)} className="mt-3 text-xs text-terracotta hover:underline">Copy embed code</button>
            </div>
          </div>
        )}

        {/* CONFIG TAB */}
        {tab === 'config' && agent.config && (
          <div className="space-y-4">
            {config.purpose && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">Purpose</div>
                <p className="text-sm text-gray-600 leading-relaxed">{config.purpose}</p>
              </div>
            )}
            {config.integrations?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">Integrations</div>
                <div className="flex flex-wrap gap-1">{config.integrations.map((int, i) => (
                  <span key={i} className="px-2 py-0.5 bg-cream rounded text-xs text-forest/70 font-medium">{int}</span>
                ))}</div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">Full Configuration</div>
              <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(agent.config, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(AgentPage)
