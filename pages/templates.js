import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import withAuth from '@/lib/withAuth'
import { supabase } from '@/lib/supabase'
import { VERTICALS, getVerticalEmoji, getVerticalLabel } from '@/lib/utils'

function TemplatesPage({ user, profile }) {
  const router = useRouter()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(null)
  const [search, setSearch] = useState('')
  const [vertical, setVertical] = useState('')
  const [complexity, setComplexity] = useState('')
  const [b2bFilter, setB2bFilter] = useState('all')
  const [sort, setSort] = useState('popular')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/agents/templates')
        const data = await res.json()
        setTemplates(Array.isArray(data) ? data : [])
      } catch {
        setTemplates([])
      }
      setLoading(false)
    }
    load()
  }, [])

  // Handle auto-deploy from landing page ?deploy= param
  useEffect(() => {
    if (!router.query.deploy || templates.length === 0) return
    const slug = router.query.deploy
    const match = templates.find(
      (t) => t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug
    )
    if (match) handleDeploy(match)
  }, [router.query.deploy, templates])

  const filtered = useMemo(() => {
    let result = templates.filter((t) => {
      const s = search.toLowerCase()
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(s) ||
        t.description.toLowerCase().includes(s) ||
        (t.config?.tags || []).some((tag) => tag.toLowerCase().includes(s))
      const matchVertical = !vertical || t.vertical === vertical || (t.config?.verticals || []).includes(vertical)
      const matchComplexity = !complexity || t.config?.complexity === complexity
      const matchB2b = b2bFilter === 'all' || t.config?.b2b_b2c === b2bFilter || t.config?.b2b_b2c === 'both'
      return matchSearch && matchVertical && matchComplexity && matchB2b
    })

    // Sort
    if (sort === 'popular') result.sort((a, b) => (b.config?.usage || '').localeCompare(a.config?.usage || ''))
    else if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'time-saved') result.sort((a, b) => {
      const getHours = (s) => parseInt(s?.replace(/\D/g, '') || '0')
      return getHours(b.config?.time_saved) - getHours(a.config?.time_saved)
    })

    return result
  }, [templates, search, vertical, complexity, b2bFilter, sort])

  async function handleDeploy(template) {
    setDeploying(template.id)
    try {
      const res = await fetch('/api/agents/deploy-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: template.id, owner_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'agent_limit_reached') {
          router.push('/pricing')
          return
        }
        throw new Error(data.error || data.message)
      }
      router.push(`/agent/${data.id}`)
    } catch (err) {
      setToast(err.message || 'Failed to deploy')
      setTimeout(() => setToast(null), 3000)
      setDeploying(null)
    }
  }

  const totalIntegrations = new Set(templates.flatMap((t) => t.config?.integrations || []))
  const avgTimeSaved = templates.length
    ? Math.round(templates.reduce((s, t) => s + parseInt((t.config?.time_saved || '0').replace(/\D/g, '') || '0'), 0) / templates.length)
    : 0

  return (
    <Layout user={user} profile={profile}>
      <div className="space-y-6">
        {/* Hero */}
        <div className="bg-forest rounded-2xl p-8 md:p-10 text-cream">
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">
            {templates.length} World-Class AI Agents.
            <span className="text-terracotta"> Ready in one click.</span>
          </h1>
          <p className="text-cream/60 text-sm max-w-xl">
            Each agent comes with a production-grade system prompt, real integrations, and deep industry expertise.
            Deploy to your workspace and start running immediately.
          </p>
          <div className="flex flex-wrap gap-6 mt-6 text-sm">
            <span className="text-cream/50"><strong className="text-cream">{templates.length}</strong> agents</span>
            <span className="text-cream/50"><strong className="text-cream">{VERTICALS.length}</strong> verticals</span>
            <span className="text-cream/50"><strong className="text-cream">{totalIntegrations.size}+</strong> integrations</span>
            <span className="text-cream/50">avg <strong className="text-cream">{avgTimeSaved}hrs/week</strong> saved</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by name, description, or tag..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm bg-white"
          />
        </div>

        {/* Filter Pills */}
        <div className="space-y-3">
          {/* Verticals */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setVertical('')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!vertical ? 'bg-terracotta text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              All
            </button>
            {VERTICALS.map((v) => (
              <button
                key={v.key}
                onClick={() => setVertical(vertical === v.key ? '' : v.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${vertical === v.key ? 'bg-terracotta text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                {v.emoji} {v.label}
              </button>
            ))}
          </div>

          {/* Secondary filters */}
          <div className="flex flex-wrap gap-3">
            {/* B2B/B2C */}
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
              {['all', 'b2b', 'b2c'].map((v) => (
                <button
                  key={v}
                  onClick={() => setB2bFilter(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-all ${b2bFilter === v ? 'bg-forest text-cream' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {v === 'all' ? 'All' : v.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Complexity */}
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-terracotta"
            >
              <option value="">All Levels</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-terracotta"
            >
              <option value="popular">Popular</option>
              <option value="name">A-Z</option>
              <option value="time-saved">Time Saved</option>
            </select>

            <span className="text-xs text-gray-400 self-center ml-auto">
              {filtered.length} of {templates.length} agents
            </span>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 bg-gray-100 rounded-xl" />
                  <div className="w-16 h-5 bg-gray-100 rounded-full" />
                </div>
                <div className="h-5 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-50 rounded w-full mb-1" />
                <div className="h-4 bg-gray-50 rounded w-2/3 mb-4" />
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3].map((j) => <div key={j} className="w-16 h-5 bg-gray-50 rounded" />)}
                </div>
                <div className="h-9 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-serif text-lg font-bold text-forest mb-2">No agents found</h3>
            <p className="text-sm text-gray-400 mb-4">Try different keywords or filters.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['invoice', 'support', 'seo', 'contract', 'onboarding'].map((s) => (
                <button key={s} onClick={() => setSearch(s)} className="px-3 py-1 bg-cream rounded-full text-xs text-forest hover:bg-gray-100 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-terracotta/20 transition-all group flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-cream flex items-center justify-center text-xl">
                    {t.config?.emoji || getVerticalEmoji(t.vertical)}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.config?.time_saved && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                        {t.config.time_saved} saved
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      t.config?.complexity === 'starter' ? 'bg-green-50 text-green-600' :
                      t.config?.complexity === 'enterprise' ? 'bg-purple-50 text-purple-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {t.config?.complexity || 'professional'}
                    </span>
                  </div>
                </div>

                {/* Name */}
                <h3 className="font-serif text-lg font-bold text-forest group-hover:text-terracotta transition-colors mb-1">
                  {t.name}
                </h3>

                {/* Use case */}
                {t.config?.use_case && (
                  <p className="text-xs text-terracotta/70 italic mb-2 line-clamp-2">
                    &quot;{t.config.use_case}&quot;
                  </p>
                )}

                {/* Description on hover */}
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {t.description}
                </p>

                {/* Integrations */}
                {t.config?.integrations && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {t.config.integrations.slice(0, 4).map((int, i) => (
                      <span key={i} className="px-2 py-0.5 bg-cream rounded text-[10px] text-forest/60 font-medium">
                        {int}
                      </span>
                    ))}
                    {t.config.integrations.length > 4 && (
                      <span className="px-2 py-0.5 bg-cream rounded text-[10px] text-forest/40">
                        +{t.config.integrations.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-auto pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                    <span>{getVerticalLabel(t.vertical)}</span>
                    {t.config?.b2b_b2c && (
                      <>
                        <span>·</span>
                        <span className="uppercase">{t.config.b2b_b2c}</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeploy(t)}
                    disabled={deploying === t.id}
                    className="w-full py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {deploying === t.id ? (
                      <>
                        <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                        Deploying...
                      </>
                    ) : (
                      '🚀 Deploy Now'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium bg-red-600 text-white animate-slide-up">
          {toast}
        </div>
      )}
    </Layout>
  )
}

export default withAuth(TemplatesPage)
