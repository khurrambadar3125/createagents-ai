import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import AgentCard from '@/components/AgentCard'
import RunModal from '@/components/RunModal'
import withAuth from '@/lib/withAuth'
import { supabase } from '@/lib/supabase'
import { PLAN_LIMITS, formatDate, truncate, getVerticalEmoji } from '@/lib/utils'

function Dashboard({ user, profile }) {
  const router = useRouter()
  const [agents, setAgents] = useState([])
  const [runs, setRuns] = useState([])
  const [fileCount, setFileCount] = useState(0)
  const [featured, setFeatured] = useState([])
  const [runAgent, setRunAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(null)

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
      // Fetch featured templates via API (bypasses RLS)
      try {
        const tplRes = await fetch('/api/agents/templates')
        const tplData = await tplRes.json()
        setFeatured(Array.isArray(tplData) ? tplData.slice(0, 6) : [])
      } catch { setFeatured([]) }
      setLoading(false)
    }
    load()

    // Send welcome email on first visit
    fetch('/api/auth/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, email: user.email, full_name: profile?.full_name }),
    }).catch(() => {})
  }, [user.id, user.email, profile?.full_name])

  async function handleDeployFeatured(template) {
    setDeploying(template.id)
    try {
      const res = await fetch('/api/agents/deploy-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: template.id, owner_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'agent_limit_reached') { router.push('/pricing'); return }
        throw new Error(data.error)
      }
      router.push(`/agent/${data.id}`)
    } catch {
      setDeploying(null)
    }
  }

  const plan = PLAN_LIMITS[profile?.plan || 'free']
  const runsUsed = profile?.runs_used || 0
  const runsLimit = plan.runs === -1 ? Infinity : plan.runs
  const runsPercent = runsLimit === Infinity ? 0 : Math.round((runsUsed / runsLimit) * 100)
  const agentCount = agents.length
  const agentLimit = plan.agents === -1 ? Infinity : plan.agents

  const stats = [
    { label: 'Agents Built', value: agentCount, max: agentLimit === Infinity ? '∞' : agentLimit },
    { label: 'Runs This Month', value: runsUsed, max: runsLimit === Infinity ? '∞' : runsLimit },
    { label: 'Files Uploaded', value: fileCount },
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

        {/* Usage Warning */}
        {runsPercent >= 100 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">You&apos;ve used all your runs this month.</p>
              <p className="text-xs text-red-500 mt-0.5">Upgrade your plan to keep building.</p>
            </div>
            <Link href="/pricing" className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
              Upgrade Now
            </Link>
          </div>
        )}
        {runsPercent >= 80 && runsPercent < 100 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-700">Running low on runs — {runsUsed}/{runsLimit} used</p>
              <p className="text-xs text-amber-500 mt-0.5">Consider upgrading before you hit the limit.</p>
            </div>
            <Link href="/pricing" className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600">
              View Plans
            </Link>
          </div>
        )}

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

        {/* Usage bar */}
        {plan.runs > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-forest">Monthly Run Usage</span>
              <span className="text-xs text-gray-400">{runsUsed} / {runsLimit} runs</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  runsPercent >= 100 ? 'bg-red-500' : runsPercent >= 80 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(runsPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/build', icon: '✦', label: 'Build Agent', color: 'bg-terracotta' },
            { href: '/templates', icon: '🚀', label: 'Browse Library', color: 'bg-forest' },
            { href: '/files', icon: '📄', label: 'Upload File', color: 'bg-gold' },
            { href: '/runs', icon: '▸', label: 'View Runs', color: 'bg-gray-700' },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`${a.color} text-white rounded-2xl p-4 hover:opacity-90 transition-opacity`}
            >
              <div className="text-2xl mb-2">{a.icon}</div>
              <div className="text-sm font-medium">{a.label}</div>
            </Link>
          ))}
        </div>

        {/* Your Agents */}
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
                Deploy a pre-built agent or describe one from scratch.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/templates" className="px-6 py-2.5 bg-forest text-cream rounded-xl text-sm font-medium hover:bg-forest/90">
                  Browse 96 Agents
                </Link>
                <Link href="/build" className="px-6 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90">
                  Build Custom
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onQuickRun={setRunAgent} />
              ))}
            </div>
          )}
        </div>

        {/* Featured Agents */}
        {featured.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-bold text-forest">Featured Agents</h2>
              <Link href="/templates" className="text-sm text-terracotta hover:underline">
                View all 96 →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center text-lg">
                      {t.config?.emoji || getVerticalEmoji(t.vertical)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-sm font-bold text-forest truncate">{t.name}</h3>
                      <p className="text-xs text-gray-400 truncate">{t.description}</p>
                    </div>
                  </div>
                  {t.config?.time_saved && (
                    <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600 mb-3">
                      Saves {t.config.time_saved}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeployFeatured(t)}
                    disabled={deploying === t.id}
                    className="w-full py-2 bg-forest text-cream rounded-xl text-xs font-medium hover:bg-forest/90 disabled:opacity-50 transition-all"
                  >
                    {deploying === t.id ? 'Deploying...' : '🚀 Deploy to Workspace'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Runs */}
        {runs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-bold text-forest">Recent Activity</h2>
              <Link href="/runs" className="text-sm text-terracotta hover:underline">View all</Link>
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
                          run.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
                        }`}>{run.status}</span>
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

      {runAgent && <RunModal agent={runAgent} onClose={() => setRunAgent(null)} />}
    </Layout>
  )
}

export default withAuth(Dashboard)
