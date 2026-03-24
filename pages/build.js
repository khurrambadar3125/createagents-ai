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

  async function handleLaunch() {
    if (!agentId) return
    setLoading(true)
    try {
      // Save any edits the user made to the blueprint
      const updatedConfig = {
        ...blueprint,
        system_prompt: blueprint.system_prompt || `You are ${name}. ${description}`,
      }
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, config: updatedConfig }),
      })
      if (!res.ok) throw new Error('Failed to save changes')
      setStep(3)
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
            {step === 1 && 'Tell us what you need'}
            {step === 2 && 'Check & customise'}
            {step === 3 && 'Ready to go!'}
          </div>
        </div>

        {/* Step 1: Describe */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-3xl font-bold text-forest mb-2">What do you need help with?</h1>
              <p className="text-gray-400">Just describe it in your own words. We&apos;ll build it for you.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-forest mb-2">Give it a name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Email Helper, Invoice Reader, Customer Chat Bot"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-forest mb-2">
                What should it do for you?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Just tell us in plain English — like you're explaining to a colleague.&#10;&#10;Example: 'I need something that reads my customer emails, figures out which ones are urgent, writes helpful replies, and lets me know on Slack if anything is critical.'"
                className="w-full h-40 px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-forest mb-3">What area is this for?</label>
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
                  Building your agent — just a moment...
                </>
              ) : (
                'Build My Agent →'
              )}
            </button>
          </div>
        )}

        {/* Step 2: Blueprint */}
        {step === 2 && blueprint && (
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-3xl font-bold text-forest mb-2">Here&apos;s your agent!</h1>
              <p className="text-gray-400">We&apos;ve built it for you. Feel free to change anything below, or go ahead and launch it.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Editable Name & Purpose */}
              <div className="p-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{getVerticalEmoji(vertical)}</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="font-serif text-xl font-bold text-forest bg-transparent outline-none border-b border-transparent focus:border-terracotta w-full"
                  />
                </div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Purpose</label>
                <textarea
                  value={blueprint.purpose || ''}
                  onChange={(e) => setBlueprint({ ...blueprint, purpose: e.target.value })}
                  className="w-full text-sm text-gray-500 leading-relaxed bg-transparent outline-none border border-transparent focus:border-gray-200 rounded-lg p-2 resize-none"
                  rows={3}
                />
              </div>

              {/* Editable Description */}
              <div className="p-6 border-b border-gray-50">
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Agent Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm text-gray-600 bg-cream/50 rounded-xl p-3 outline-none border border-transparent focus:border-terracotta/30 resize-none"
                  rows={2}
                />
              </div>

              {/* Steps */}
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-sm font-medium text-forest mb-3 uppercase tracking-wider">What it will do</h3>
                <div className="space-y-2">
                  {(blueprint.steps || []).map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                        {i + 1}
                      </div>
                      <input
                        value={s}
                        onChange={(e) => {
                          const newSteps = [...blueprint.steps]
                          newSteps[i] = e.target.value
                          setBlueprint({ ...blueprint, steps: newSteps })
                        }}
                        className="flex-1 text-sm text-gray-600 bg-transparent outline-none border-b border-transparent focus:border-gray-200 py-1"
                      />
                      <button
                        onClick={() => {
                          const newSteps = blueprint.steps.filter((_, j) => j !== i)
                          setBlueprint({ ...blueprint, steps: newSteps })
                        }}
                        className="text-gray-300 hover:text-red-400 text-xs mt-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setBlueprint({ ...blueprint, steps: [...(blueprint.steps || []), ''] })}
                    className="text-xs text-terracotta hover:underline mt-1"
                  >
                    + Add step
                  </button>
                </div>
              </div>

              {/* Integrations */}
              {blueprint.integrations?.length > 0 && (
                <div className="p-6 border-b border-gray-50">
                  <h3 className="text-sm font-medium text-forest mb-3 uppercase tracking-wider">Tools it connects to</h3>
                  <div className="flex flex-wrap gap-2">
                    {blueprint.integrations.map((int, i) => (
                      <span key={i} className="px-3 py-1 bg-cream rounded-full text-xs text-forest font-medium flex items-center gap-1">
                        {int}
                        <button
                          onClick={() => {
                            const newInt = blueprint.integrations.filter((_, j) => j !== i)
                            setBlueprint({ ...blueprint, integrations: newInt })
                          }}
                          className="text-gray-300 hover:text-red-400 ml-1"
                        >
                          ✕
                        </button>
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

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-6 py-3 border border-terracotta/30 rounded-xl text-sm font-medium text-terracotta hover:bg-terracotta/5 transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-terracotta border-t-transparent rounded-full" />
                    Regenerating...
                  </>
                ) : (
                  '↻ Try Again'
                )}
              </button>
              <button
                onClick={handleLaunch}
                disabled={loading}
                className="flex-1 py-3 bg-terracotta text-white rounded-xl font-medium text-sm hover:bg-terracotta/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    Saving...
                  </>
                ) : (
                  'Launch My Agent →'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Celebration */}
        {step === 3 && (
          <div className="text-center py-12 space-y-6">
            <div className="text-6xl">🎉</div>
            <h1 className="font-serif text-4xl font-bold text-forest">
              You&apos;re all set!
            </h1>
            <p className="text-gray-400 max-w-md mx-auto">
              <strong className="text-forest">{name}</strong> is ready. Just give it a task
              and it&apos;ll do the work for you.
            </p>
            <div className="flex flex-col items-center gap-3 pt-4">
              <button
                onClick={() => router.push(`/agent/${agentId}`)}
                className="px-10 py-3.5 bg-terracotta text-white rounded-xl font-medium text-sm hover:bg-terracotta/90 transition-all"
              >
                Try It Now →
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-gray-400 hover:text-forest transition-colors"
              >
                or go to My Agents
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(BuildPage)
