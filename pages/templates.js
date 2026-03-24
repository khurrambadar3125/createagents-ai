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
  const [difficulty, setDifficulty] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('agents')
        .select('*')
        .is('owner_id', null)
        .order('name')
      setTemplates(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
      const matchVertical = !vertical || t.vertical === vertical || t.config?.verticals?.includes(vertical)
      const matchDifficulty = !difficulty || t.config?.difficulty === difficulty
      return matchSearch && matchVertical && matchDifficulty
    })
  }, [templates, search, vertical, difficulty])

  async function handleDeploy(template) {
    setDeploying(template.id)
    try {
      const res = await fetch('/api/agents/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: template.id, owner_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/agent/${data.id}`)
    } catch (err) {
      alert(err.message || 'Failed to deploy template')
      setDeploying(null)
    }
  }

  return (
    <Layout user={user} profile={profile}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest">Agent Library</h1>
          <p className="text-gray-400 text-sm mt-1">
            80+ pre-built agents ready to deploy. One click and it&apos;s yours.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents by name or description..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm"
            />
          </div>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-terracotta"
          >
            <option value="">All Verticals</option>
            {VERTICALS.map((v) => (
              <option key={v.key} value={v.key}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-terracotta"
          >
            <option value="">All Levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Count */}
        <div className="text-sm text-gray-400">
          Showing {filtered.length} of {templates.length} agents
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="w-11 h-11 bg-gray-100 rounded-xl mb-3" />
                <div className="h-5 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-50 rounded w-full mb-1" />
                <div className="h-4 bg-gray-50 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-serif text-lg font-bold text-forest mb-2">No agents found</h3>
            <p className="text-sm text-gray-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-terracotta/20 transition-all group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-cream flex items-center justify-center text-xl">
                    {template.config?.emoji || getVerticalEmoji(template.vertical)}
                  </div>
                  <div className="flex items-center gap-2">
                    {template.config?.rating && (
                      <span className="text-xs text-yellow-500 font-medium">
                        ★ {template.config.rating}
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      template.config?.difficulty === 'easy'
                        ? 'bg-green-50 text-green-600'
                        : template.config?.difficulty === 'advanced'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {template.config?.difficulty || 'medium'}
                    </span>
                  </div>
                </div>

                {/* Name & Description */}
                <h3 className="font-serif text-lg font-bold text-forest group-hover:text-terracotta transition-colors mb-1">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {template.description}
                </p>

                {/* Integrations */}
                {template.config?.integrations && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.config.integrations.slice(0, 4).map((int, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-cream rounded text-[10px] text-forest/60 font-medium"
                      >
                        {int}
                      </span>
                    ))}
                    {template.config.integrations.length > 4 && (
                      <span className="px-2 py-0.5 bg-cream rounded text-[10px] text-forest/40">
                        +{template.config.integrations.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{getVerticalLabel(template.vertical)}</span>
                    {template.config?.usage && (
                      <>
                        <span>·</span>
                        <span>{template.config.usage} uses</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeploy(template)}
                    disabled={deploying === template.id}
                    className="text-xs font-medium text-white bg-terracotta hover:bg-terracotta/90 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    {deploying === template.id ? (
                      <>
                        <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                        Deploying...
                      </>
                    ) : (
                      'Deploy →'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(TemplatesPage)
