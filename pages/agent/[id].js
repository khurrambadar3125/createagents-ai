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
      if (!res.ok) throw new Error(data.error || 'Run failed')
      setResult(data)
      // Refresh runs
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
    const { error: updateError } = await supabase
      .from('agents')
      .update({ name: editName, description: editDesc })
      .eq('id', id)
    if (!updateError) {
      setAgent({ ...agent, name: editName, description: editDesc })
      setEditing(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this agent? This cannot be undone.')) return
    await supabase.from('agents').delete().eq('id', id)
    router.push('/dashboard')
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

  return (
    <Layout user={user} profile={profile}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cream flex items-center justify-center text-2xl">
              {getVerticalEmoji(agent.vertical)}
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
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                <span>{getVerticalLabel(agent.vertical)}</span>
                <span>·</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(agent.status)}`}>
                  {agent.status}
                </span>
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

        {/* Run Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-serif text-lg font-bold text-forest mb-3">Run Agent</h2>
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you need this agent to do..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm resize-none h-24"
              disabled={running}
            />
          </div>
          <div className="flex justify-end mt-3">
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
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>
          )}

          {result && (
            <div className="mt-4 space-y-3">
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 max-w-xs truncate">
                        {run.input?.text || '—'}
                      </td>
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

        {/* Config */}
        {agent.config && (
          <div>
            <h2 className="font-serif text-lg font-bold text-forest mb-3">Agent Config</h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(agent.config, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(AgentPage)
