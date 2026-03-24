import { useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import withAuth from '@/lib/withAuth'

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    annual: 0,
    runs: '15',
    agents: '3',
    features: ['15 runs/month', '3 agents', 'Community support', 'All 96 templates', 'Basic file uploads'],
    cta: 'Current Plan',
    highlight: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    price: 19,
    annual: 12,
    runs: '400',
    agents: '10',
    features: ['400 runs/month', '10 agents', 'Email support', 'All 96 templates', 'Unlimited file uploads', 'Run history export'],
    cta: 'Upgrade',
    highlight: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 39,
    annual: 25,
    runs: '900',
    agents: 'Unlimited',
    features: ['900 runs/month', 'Unlimited agents', 'Priority support', 'All 96 templates', 'Unlimited file uploads', 'Custom system prompts', 'API access'],
    cta: 'Upgrade',
    highlight: true,
  },
  {
    key: 'business',
    name: 'Business',
    price: 99,
    annual: 64,
    runs: 'Unlimited',
    agents: 'Unlimited',
    features: ['Unlimited runs (BYOK)', '10 team seats', 'Dedicated support', 'All 96 templates', 'Bring Your Own Key', 'Custom integrations', 'SSO / SAML', 'SLA guarantee'],
    cta: 'Upgrade',
    highlight: false,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: null,
    annual: null,
    runs: 'Custom',
    agents: 'Custom',
    features: ['Everything in Business', 'White-label option', 'Custom SLA', 'Dedicated success manager', 'Custom integrations', 'On-premise deployment', 'Training & workshops'],
    cta: 'Contact Sales',
    highlight: false,
  },
]

const FAQS = [
  { q: 'What counts as a "run"?', a: 'Each time you execute an agent with an input, that counts as one run. Whether it processes an invoice, writes a report, or answers a question — that\'s one run.' },
  { q: 'Can I change plans anytime?', a: 'Yes! Upgrade or downgrade at any time. When you upgrade, you get access to the new limits immediately. When you downgrade, your current billing period finishes first.' },
  { q: 'What happens when I hit my run limit?', a: 'Your existing agents stay active, but new runs are paused until your next billing cycle or until you upgrade. We\'ll warn you when you\'re running low.' },
  { q: 'What does "Bring Your Own Key" mean?', a: 'On the Business plan, you can use your own Anthropic API key. This means unlimited runs at your own API cost — perfect for high-volume enterprise use cases.' },
  { q: 'How does PayPal billing work?', a: 'We use PayPal subscriptions for recurring billing. You can manage, pause, or cancel your subscription anytime directly through PayPal or from your settings page.' },
]

function PricingPage({ user, profile }) {
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState(null)
  const [faqOpen, setFaqOpen] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  async function handleUpgrade(planKey) {
    if (planKey === 'enterprise') {
      window.open('mailto:hello@createagents.ai?subject=Enterprise inquiry', '_blank')
      return
    }
    if (planKey === 'free') return

    setLoading(planKey)
    try {
      const planKeyFull = `${planKey}-${annual ? 'annual' : 'monthly'}`
      const res = await fetch('/api/paypal/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_key: planKeyFull, user_id: user.id, email: user.email }),
      })
      const data = await res.json()
      if (data.approve_url) {
        window.location.href = data.approve_url
      } else {
        alert(data.error || 'Failed to create PayPal subscription. Please try again.')
      }
    } catch (err) {
      alert('Something went wrong. Please try again.')
    }
    setLoading(null)
  }

  async function handleCancel() {
    if (!confirm('Cancel your subscription? You\'ll keep access until the end of your billing period.')) return
    setCancelling(true)
    try {
      const res = await fetch('/api/paypal/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const data = await res.json()
      if (data.cancelled) {
        alert('Subscription cancelled. You\'ll keep access until the end of your billing period.')
        window.location.reload()
      } else {
        alert(data.error || 'Failed to cancel. Please try through PayPal directly.')
      }
    } catch {
      alert('Something went wrong.')
    }
    setCancelling(false)
  }

  const currentPlan = profile?.plan || 'free'

  return (
    <Layout user={user} profile={profile}>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Hero */}
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold text-forest mb-3">
            Simple, transparent pricing.
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Scale as you grow. Start free, upgrade when you need more power. Powered by PayPal.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm ${!annual ? 'text-forest font-medium' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-terracotta' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm ${annual ? 'text-forest font-medium' : 'text-gray-400'}`}>
              Annual <span className="text-terracotta text-xs font-medium ml-1">Save 35%</span>
            </span>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'bg-forest text-cream border-2 border-terracotta relative'
                  : 'bg-white border border-gray-100'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-terracotta text-white text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}
              <div className="mb-4">
                <h3 className={`font-serif text-lg font-bold ${plan.highlight ? '' : 'text-forest'}`}>
                  {plan.name}
                </h3>
                {plan.price !== null ? (
                  <div className="mt-2">
                    <span className={`font-serif text-3xl font-bold ${plan.highlight ? '' : 'text-forest'}`}>
                      ${annual ? plan.annual : plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlight ? 'text-cream/60' : 'text-gray-400'}`}>
                      {plan.price > 0 ? '/mo' : ''}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2">
                    <span className={`font-serif text-2xl font-bold ${plan.highlight ? '' : 'text-forest'}`}>Custom</span>
                  </div>
                )}
              </div>

              <ul className="flex-1 space-y-2 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${plan.highlight ? 'text-cream/80' : 'text-gray-500'}`}>
                    <span className="text-terracotta mt-0.5">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>

              {currentPlan === plan.key ? (
                <div className="text-center py-2.5 rounded-xl text-sm font-medium bg-green-50 text-green-600 border border-green-100">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={loading === plan.key}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                    plan.highlight
                      ? 'bg-terracotta text-white hover:bg-terracotta/90'
                      : 'bg-forest text-cream hover:bg-forest/90'
                  }`}
                >
                  {loading === plan.key ? 'Redirecting to PayPal...' : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Cancel subscription for paid users */}
        {currentPlan !== 'free' && (
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-400">
              Your <strong className="text-forest">{currentPlan}</strong> subscription is managed through PayPal.
            </p>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm text-red-400 hover:text-red-600 hover:underline disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          </div>
        )}

        {/* PayPal trust badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Secure payments via PayPal. Cancel anytime.
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-2xl font-bold text-forest text-center mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <span className="text-sm font-medium text-forest">{faq.q}</span>
                  <span className="text-gray-300 ml-4">{faqOpen === i ? '−' : '+'}</span>
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default withAuth(PricingPage)
