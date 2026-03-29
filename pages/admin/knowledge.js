import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import withAuth from '@/lib/withAuth'

const DOMAINS = [
  'ai-agents', 'healthcare', 'finance', 'legal', 'audit', 'government',
  'marketing', 'hr', 'education', 'operations', 'engineering',
  'gcc-enterprise', 'pakistan-enterprise', 'sustainability', 'platform',
]
const SOURCE_TYPES = ['framework', 'regulation', 'textbook', 'case_study', 'best_practice', 'research', 'howto', 'glossary', 'faq']

function KnowledgeAdmin({ user, profile }) {
  const [stats, setStats] = useState(null)
  const [docs, setDocs] = useState([])
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', domain: 'ai-agents', source_type: 'best_practice', vertical: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const isAdmin = user?.email === 'khurrambadar@gmail.com'

  useEffect(() => {
    loadStats()
    loadDocs()
  }, [filterDomain, search])

  async function loadStats() {
    const res = await fetch('/api/admin/knowledge/stats')
    setStats(await res.json())
  }

  async function loadDocs() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (filterDomain) params.set('domain', filterDomain)
    if (search) params.set('q', search)
    const res = await fetch(`/api/knowledge/search?${params}`)
    const data = await res.json()
    setDocs(data.data || [])
    setLoading(false)
  }

  async function handleAdd() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/knowledge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: user.email,
          ...form,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage(`Added! ${data.chunks_stored} chunk(s) stored.`)
      setForm({ title: '', content: '', domain: 'ai-agents', source_type: 'best_practice', vertical: '', tags: '' })
      setAdding(false)
      loadStats()
      loadDocs()
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this document?')) return
    await fetch('/api/admin/knowledge/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: user.email, document_id: id }),
    })
    loadDocs()
    loadStats()
  }

  if (!isAdmin) {
    return (
      <Layout user={user} profile={profile}>
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="font-serif text-2xl font-bold text-forest">Admin Access Only</h1>
        </div>
      </Layout>
    )
  }

  return (
    <Layout user={user} profile={profile}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-forest">Knowledge Brain</h1>
            <p className="text-gray-400 text-sm mt-1">Manage the encyclopaedic knowledge that powers every agent</p>
          </div>
          <button
            onClick={() => setAdding(!adding)}
            className="px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90"
          >
            {adding ? 'Cancel' : '+ Add Document'}
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Documents</div>
              <div className="font-serif text-2xl font-bold text-forest">{stats.total}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Words</div>
              <div className="font-serif text-2xl font-bold text-forest">{(stats.total_words || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Domains</div>
              <div className="font-serif text-2xl font-bold text-forest">{Object.keys(stats.by_domain || {}).length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Avg Words/Doc</div>
              <div className="font-serif text-2xl font-bold text-forest">{stats.total ? Math.round(stats.total_words / stats.total) : 0}</div>
            </div>
          </div>
        )}

        {/* Domain breakdown */}
        {stats?.by_domain && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-medium">Documents by Domain</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_domain).sort((a, b) => b[1] - a[1]).map(([d, count]) => (
                <span key={d} className="px-3 py-1 bg-cream rounded-full text-xs text-forest">
                  {d}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add Document Form */}
        {adding && (
          <div className="bg-white rounded-2xl border border-terracotta/20 p-6 space-y-4">
            <h2 className="font-serif text-lg font-bold text-forest">Add Knowledge Document</h2>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Document title" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-terracotta" />
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Document content (300-800 words of real knowledge)" rows={10} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-terracotta resize-none" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none">
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none">
                {SOURCE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} placeholder="Vertical (optional)" className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none" />
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma-separated)" className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none" />
            </div>
            {message && <div className={`text-sm px-4 py-2 rounded-xl ${message.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{message}</div>}
            <button onClick={handleAdd} disabled={saving || !form.title || !form.content} className="px-6 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Add Document'}
            </button>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-terracotta" />
          <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none">
            <option value="">All domains</option>
            {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Document List */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-3 border-terracotta border-t-transparent rounded-full" /></div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-forest truncate">{doc.title}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="px-2 py-0.5 bg-cream rounded text-[10px]">{doc.domain}</span>
                    <span>{doc.source_type}</span>
                    <span>{doc.word_count} words</span>
                    {doc.vertical && <span className="text-terracotta">{doc.vertical}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-400 hover:text-red-600 ml-4">Delete</button>
              </div>
            ))}
            {docs.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400">No documents found.</div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(KnowledgeAdmin)
