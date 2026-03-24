import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import withAuth from '@/lib/withAuth'
import { supabase } from '@/lib/supabase'
import { formatDate, statusColor, truncate } from '@/lib/utils'

function RunsPage({ user, profile }) {
  const [runs, setRuns] = useState([])
  const [agents, setAgents] = useState([])
  const [filterAgent, setFilterAgent] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: agentsList } = await supabase
        .from('agents')
        .select('id, name')
        .eq('owner_id', user.id)
      setAgents(agentsList || [])

      let query = supabase
        .from('agent_runs')
        .select('*, agents(name)')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(100)

      if (filterAgent) query = query.eq('agent_id', filterAgent)
      if (filterStatus) query = query.eq('status', filterStatus)

      const { data } = await query
      setRuns(data || [])
      setLoading(false)
    }
    load()
  }, [user.id, filterAgent, filterStatus])

  const [expanded, setExpanded] = useState(null)

  return (
    <Layout user={user} profile={profile}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest">Run History</h1>
          <p className="text-gray-400 text-sm mt-1">All agent runs across your workspace</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={filterAgent}
            onChange={(e) => { setFilterAgent(e.target.value); setLoading(true) }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-terracotta"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setLoading(true) }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-terracotta"
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-3 border-terracotta border-t-transparent rounded-full" />
          </div>
        ) : runs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">▸</div>
            <h3 className="font-serif text-lg font-bold text-forest mb-2">No runs yet</h3>
            <p className="text-sm text-gray-400">Run an agent to see results here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <div
                key={run.id}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(expanded === run.id ? null : run.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(run.status)}`}>
                    {run.status}
                  </span>
                  <span className="text-sm font-medium text-forest flex-1">
                    {run.agents?.name || 'Unknown agent'}
                  </span>
                  <span className="text-xs text-gray-400 hidden md:inline">
                    {run.tokens_used} tokens · {run.duration_ms}ms
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(run.started_at)}</span>
                  <span className="text-gray-300">{expanded === run.id ? '▾' : '▸'}</span>
                </button>
                {expanded === run.id && (
                  <div className="px-5 pb-4 border-t border-gray-50 pt-3 space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Input</div>
                      <div className="text-sm text-gray-600 bg-cream p-3 rounded-lg">
                        {run.input?.text || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Output</div>
                      <div className="text-sm text-forest bg-forest/5 p-3 rounded-lg whitespace-pre-wrap">
                        {run.output?.text || '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(RunsPage)
