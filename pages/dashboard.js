import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import AgentCard from '@/components/AgentCard'
import RunModal from '@/components/RunModal'
import withAuth from '@/lib/withAuth'
import { supabase } from '@/lib/supabase'
import { PLAN_LIMITS, formatDate, truncate } from '@/lib/utils'

function Dashboard({ user, profile }) {
  const [agents, setAgents] = useState([])
  const [runs, setRuns] = useState([])
  const [fileCount, setFileCount] = useState(0)
  const [runAgent, setRunAgent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [agentsRes, runsRes, filesRes] = await Promise.all([
        supabase.from('agents').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
        supabase.from('agent_runs').select('*, agents(name)').eq('user_id', user.id).order('started_at', { ascending: false }).limit(10),
        supabase.from('files').select('id', { count: 'exact' }).eq('owner_id', user.id),
      ])
      setAgents(agentsRes.data || [])
      setRuns(runsRes.data || [])
      setFileCount(filesRes.count || 0)
      setLoading(false)
    }
    load()
  }, [user.id])

  const plan = PLAN_LIMITS[profile?.plan || 'free']
  const stats = [
    { label: 'Agents Built', value: agents.length, max: plan.agents === -1 ? '∞' : plan.agents },
    { label: 'Runs Used', value: profile?.runs_used || 0, max: plan.runs === -1 ? '∞' : plan.runs },
    { label: 'Files', value: fileCount },
    { label: 'Plan', value: plan.label },
  ]

  return (
    <Layout user={user} profile={profile}>
      <div className="space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Here&apos;s what&apos;s happening with your agents</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{s.label}</div>
              <div className="font-serif text-2xl font-bold text-forest">
                {s.value}
                {s.max !== undefined && (
                  <span className="text-sm text-gray-300 font-sans font-normal">/{s.max}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Agents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-bold text-forest">Your Agents</h2>
            <Link
              href="/build"
              className="px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-all"
            >
              + Build New Agent
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                  <div className="w-11 h-11 bg-gray-100 rounded-xl mb-3" />
                  <div className="h-5 bg-gray-100 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-gray-50 rounded w-full mb-1" />
                  <div className="h-4 bg-gray-50 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3">🤖</div>
              <h3 className="font-serif text-lg font-bold text-forest mb-2">No agents yet</h3>
              <p className="text-sm text-gray-400 mb-4">
                Describe the agent you need and we&apos;ll build it for you.
              </p>
              <Link
                href="/build"
                className="inline-block px-6 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 transition-all"
              >
                Build Your First Agent
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onQuickRun={setRunAgent} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Runs */}
        {runs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-bold text-forest">Recent Runs</h2>
              <Link href="/runs" className="text-sm text-terracotta hover:underline">
                View all
              </Link>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Agent</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider hidden md:table-cell">Output</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">When</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-forest">{run.agents?.name || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          run.status === 'completed' ? 'bg-green-50 text-green-600' :
                          run.status === 'failed' ? 'bg-red-50 text-red-600' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 hidden md:table-cell">{truncate(run.output?.text, 60)}</td>
                      <td className="px-5 py-3 text-gray-400">{formatDate(run.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Run Modal */}
      {runAgent && <RunModal agent={runAgent} onClose={() => setRunAgent(null)} />}
    </Layout>
  )
}

export default withAuth(Dashboard)
