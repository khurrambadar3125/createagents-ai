import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
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
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [copied, setCopied] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

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

  async function handleRun() {
    if (!input.trim()) return
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: id, user_input: input }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'limit_reached') {
          setError(`Run limit reached (${data.runs_used}/${data.runs_limit}). Upgrade your plan to continue.`)
        } else {
          throw new Error(data.error || data.message || 'Run failed')
        }
        return
      }
      setResult(data)
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

  function handleCopy() {
    if (result?.output) {
      navigator.clipboard.writeText(result.output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleRunAgain() {
    setResult(null)
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
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="font-serif text-2xl font-bold text-forest border-b border-terracotta outline-none bg-transparent"
                />
              ) : (
                <h1 className="font-serif text-2xl font-bold text-forest">{agent.name}</h1>
              )}
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400 flex-wrap">
                <span>{getVerticalLabel(agent.vertical)}</span>
                <span>·</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(agent.status)}`}>{agent.status}</span>
                <span>·</span>
                <span>{agent.run_count || 0} runs</span>
                {config.complexity && (
                  <>
                    <span>·</span>
                    <span className="capitalize">{config.complexity}</span>
                  </>
                )}
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
                <button onClick={() => setEditing(true)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">Edit</button>
                <button onClick={handleDelete} className="px-4 py-2 border border-red-200 rounded-xl text-sm text-red-500 hover:bg-red-50">Delete</button>
              </>
            )}
          </div>
        </div>

        {editing && (
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full h-20 px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:border-terracotta"
          />
        )}

        {/* Agent Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {config.purpose && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">Purpose</div>
              <p className="text-sm text-gray-600 leading-relaxed">{config.purpose}</p>
            </div>
          )}
          {config.integrations?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">Integrations</div>
              <div className="flex flex-wrap gap-1">
                {config.integrations.map((int, i) => (
                  <span key={i} className="px-2 py-0.5 bg-cream rounded text-xs text-forest/70 font-medium">{int}</span>
                ))}
              </div>
            </div>
          )}
          {config.steps?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">Steps</div>
              <div className="space-y-1.5">
                {config.steps.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Run Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-bold text-forest">Run Agent</h2>
            <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Powered by Claude Haiku</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you need this agent to do..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm resize-none h-24"
            disabled={running}
          />
          <div className="flex justify-end mt-3 gap-2">
            {result && (
              <button
                onClick={handleRunAgain}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
              >
                Run Again
              </button>
            )}
            <button
              onClick={handleRun}
              disabled={running || !input.trim()}
              className="px-6 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {running ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Running...
                </>
              ) : (
                'Run Agent ▸'
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm">
              {error}
              {error.includes('limit') && (
                <a href="/pricing" className="block mt-2 text-red-700 underline font-medium">
                  Upgrade your plan →
                </a>
              )}
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-3">
              <div className="p-5 bg-forest/5 rounded-xl relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Output</div>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-gray-400 hover:text-forest px-2 py-1 rounded hover:bg-white transition-colors"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className="text-sm text-forest whitespace-pre-wrap leading-relaxed">
                  {result.output}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{result.tokens_used} tokens</span>
                <span>{result.duration_ms}ms</span>
                <span className="ml-auto text-[10px] bg-gray-50 px-2 py-0.5 rounded-full">claude-haiku-4-5-20251001</span>
              </div>
            </div>
          )}
        </div>

        {/* Run History */}
        {runs.length > 0 && (
          <div>
            <h2 className="font-serif text-lg font-bold text-forest mb-3">Run History</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Input</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider hidden md:table-cell">Tokens</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider hidden md:table-cell">Duration</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">When</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(run.status)}`}>{run.status}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{run.input?.text || '—'}</td>
                      <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{run.tokens_used || '—'}</td>
                      <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{run.duration_ms ? `${run.duration_ms}ms` : '—'}</td>
                      <td className="px-5 py-3 text-gray-400">{formatDate(run.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Deploy / Share */}
        <div>
          <h2 className="font-serif text-lg font-bold text-forest mb-3">Use This Agent Anywhere</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Share Link */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-2xl mb-2">🔗</div>
              <h3 className="font-serif text-sm font-bold text-forest mb-1">Share Link</h3>
              <p className="text-xs text-gray-400 mb-3">Anyone with this link can use your agent — no sign-up needed.</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : 'https://createagents.ai'}/share/${id}`}
                  className="flex-1 px-3 py-2 bg-cream rounded-lg text-xs text-forest truncate outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/share/${id}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="px-3 py-2 bg-forest text-cream rounded-lg text-xs font-medium hover:bg-forest/90 transition-all whitespace-nowrap"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <a
                href={`/share/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-3 text-xs text-terracotta hover:underline"
              >
                Open in new tab →
              </a>
            </div>

            {/* API */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-serif text-sm font-bold text-forest mb-1">API Endpoint</h3>
              <p className="text-xs text-gray-400 mb-3">Call your agent from any app, website, or automation tool.</p>
              <div className="bg-forest/5 rounded-lg p-3 text-xs font-mono text-forest overflow-x-auto">
                <div className="text-gray-400 mb-1">POST /api/v1/run</div>
                <div className="whitespace-pre">{`{
  "agent_id": "${id}",
  "user_input": "your message"
}`}</div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`curl -X POST ${window.location.origin}/api/v1/run \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id": "${id}", "user_input": "Hello"}'`)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="mt-3 text-xs text-terracotta hover:underline"
              >
                Copy cURL command
              </button>
            </div>

            {/* Embed */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-2xl mb-2">📦</div>
              <h3 className="font-serif text-sm font-bold text-forest mb-1">Embed on Your Website</h3>
              <p className="text-xs text-gray-400 mb-3">Add a chat bubble to any website with one line of code.</p>
              <div className="bg-forest/5 rounded-lg p-3 text-xs font-mono text-forest overflow-x-auto">
                <div className="break-all">{`<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://createagents.ai'}/embed.js" data-agent-id="${id}"></script>`}</div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`<script src="${window.location.origin}/embed.js" data-agent-id="${id}"></script>`)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="mt-3 text-xs text-terracotta hover:underline"
              >
                Copy embed code
              </button>
            </div>
          </div>
        </div>

        {/* Config Toggle */}
        {agent.config && (
          <div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-forest transition-colors"
            >
              <span>{showConfig ? '▾' : '▸'}</span>
              <span>Agent Configuration</span>
            </button>
            {showConfig && (
              <div className="mt-3 bg-white rounded-2xl border border-gray-100 p-5">
                <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(agent.config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(AgentPage)
