import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import withAuth from '@/lib/withAuth'
import { VERTICALS, getVerticalEmoji } from '@/lib/utils'

function BuildPage({ user, profile }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [vertical, setVertical] = useState('')
  const [loading, setLoading] = useState(false)
  const [blueprint, setBlueprint] = useState(null)
  const [agentId, setAgentId] = useState(null)
  const [error, setError] = useState(null)

  async function handleGenerate() {
    if (!name.trim() || !description.trim() || !vertical) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, vertical }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create agent')
      setBlueprint(data.config)
      setAgentId(data.id)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout user={user} profile={profile}>
      <div className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? 'bg-terracotta text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-0.5 ${step > s ? 'bg-terracotta' : 'bg-gray-100'}`} />
              )}
            </div>
          ))}
          <div className="ml-4 text-sm text-gray-400">
            {step === 1 && 'Describe your agent'}
            {step === 2 && 'Review blueprint'}
            {step === 3 && 'Agent ready!'}
          </div>
        </div>

        {/* Step 1: Describe */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-3xl font-bold text-forest mb-2">Build a New Agent</h1>
              <p className="text-gray-400">Describe what you need in plain English. CreateAgent will architect it.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-forest mb-2">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer Support Bot, Invoice Analyzer, Lead Qualifier"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-forest mb-2">
                What should this agent do?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe in plain English what this agent should do. Be as specific as you want — the more detail, the better the agent.&#10;&#10;Example: 'An agent that reads customer support emails, categorizes them by urgency, drafts responses following our brand voice, and escalates critical issues to the team lead via Slack.'"
                className="w-full h-40 px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-forest mb-3">Industry Vertical</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {VERTICALS.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setVertical(v.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-all ${
                      vertical === v.key
                        ? 'border-terracotta bg-terracotta/5 text-terracotta font-medium'
                        : 'border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    <span>{v.emoji}</span>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

            <button
              onClick={handleGenerate}
              disabled={loading || !name.trim() || !description.trim() || !vertical}
              className="w-full py-3.5 bg-terracotta text-white rounded-xl font-medium text-sm hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  CreateAgent is architecting your agent...
                </>
              ) : (
                'Generate Agent Blueprint →'
              )}
            </button>
          </div>
        )}

        {/* Step 2: Blueprint */}
        {step === 2 && blueprint && (
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-3xl font-bold text-forest mb-2">Agent Blueprint</h1>
              <p className="text-gray-400">Your agent blueprint is ready. Review it below.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Purpose */}
              <div className="p-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{getVerticalEmoji(vertical)}</span>
                  <h2 className="font-serif text-xl font-bold text-forest">{name}</h2>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{blueprint.purpose}</p>
              </div>

              {/* Steps */}
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-sm font-medium text-forest mb-3 uppercase tracking-wider">How it works</h3>
                <div className="space-y-3">
                  {(blueprint.steps || []).map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <span className="text-sm text-gray-600">{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrations */}
              {blueprint.integrations?.length > 0 && (
                <div className="p-6 border-b border-gray-50">
                  <h3 className="text-sm font-medium text-forest mb-3 uppercase tracking-wider">Integrations</h3>
                  <div className="flex flex-wrap gap-2">
                    {blueprint.integrations.map((int, i) => (
                      <span key={i} className="px-3 py-1 bg-cream rounded-full text-xs text-forest font-medium">
                        {int}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {blueprint.tags?.length > 0 && (
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {blueprint.tags.map((tag, i) => (
                      <span key={i} className="px-2.5 py-0.5 bg-forest/5 rounded text-xs text-forest/60">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 bg-terracotta text-white rounded-xl font-medium text-sm hover:bg-terracotta/90 transition-all"
              >
                Deploy Agent →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Celebration */}
        {step === 3 && (
          <div className="text-center py-12 space-y-6">
            <div className="text-6xl">🎉</div>
            <h1 className="font-serif text-4xl font-bold text-forest">
              Your Agent is Live!
            </h1>
            <p className="text-gray-400 max-w-md mx-auto">
              <strong className="text-forest">{name}</strong> has been deployed and is ready to run.
              Give it a task and watch the magic happen.
            </p>
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => router.push(`/agent/${agentId}`)}
                className="px-8 py-3 bg-terracotta text-white rounded-xl font-medium text-sm hover:bg-terracotta/90 transition-all"
              >
                Run It Now →
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(BuildPage)
