export const VERTICALS = [
  { key: 'healthcare', label: 'Healthcare', emoji: '🏥' },
  { key: 'finance', label: 'Finance', emoji: '💰' },
  { key: 'ecommerce', label: 'E-Commerce', emoji: '🛒' },
  { key: 'legal', label: 'Legal', emoji: '⚖️' },
  { key: 'real-estate', label: 'Real Estate', emoji: '🏠' },
  { key: 'marketing', label: 'Marketing', emoji: '📣' },
  { key: 'hr', label: 'HR & People', emoji: '👥' },
  { key: 'education', label: 'Education', emoji: '📚' },
  { key: 'engineering', label: 'Engineering', emoji: '⚙️' },
  { key: 'operations', label: 'Operations', emoji: '📊' },
  { key: 'media', label: 'Media', emoji: '🎬' },
  { key: 'logistics', label: 'Logistics', emoji: '🚚' },
  { key: 'agriculture', label: 'Agriculture', emoji: '🌾' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'nonprofit', label: 'Nonprofit', emoji: '💚' },
  { key: 'sports', label: 'Sports', emoji: '⚽' },
  { key: 'government', label: 'Government', emoji: '🏛️' },
  { key: 'audit', label: 'Audit & Compliance', emoji: '📋' },
]

export function getVerticalEmoji(key) {
  const v = VERTICALS.find((v) => v.key === key)
  return v ? v.emoji : '🤖'
}

export function getVerticalLabel(key) {
  const v = VERTICALS.find((v) => v.key === key)
  return v ? v.label : key
}

export const PLAN_LIMITS = {
  free: { runs: 15, agents: 3, label: 'Free', price: 0 },
  starter: { runs: 400, agents: 10, label: 'Starter', price: 19 },
  pro: { runs: 900, agents: -1, label: 'Pro', price: 39 },
  business: { runs: -1, agents: -1, label: 'Business', price: 99 },
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function truncate(str, len = 80) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

export function statusColor(status) {
  switch (status) {
    case 'completed': return 'text-green-600 bg-green-50'
    case 'running': return 'text-yellow-600 bg-yellow-50'
    case 'failed': return 'text-red-600 bg-red-50'
    case 'active': return 'text-green-600 bg-green-50'
    case 'draft': return 'text-gray-500 bg-gray-50'
    default: return 'text-gray-500 bg-gray-50'
  }
}

export function getVerticalSystemPromptGuidance(vertical) {
  const guidance = {
    healthcare: 'Be HIPAA-aware. Always recommend consulting medical professionals for health decisions. Never provide diagnoses.',
    finance: 'Be SAMA/FCA-aware. Never provide investment advice. Always include financial disclaimers.',
    legal: 'Be jurisdiction-aware. Always recommend consulting a qualified solicitor/attorney. Never provide legal advice as fact.',
    audit: 'Follow SOX/GAAP/IFRS standards. Be evidence-based and workpaper-ready. Maintain professional skepticism.',
    government: 'Be formal and policy-aware. Support multi-language output. Follow OECD AI principles.',
    education: 'Be safe, encouraging, and age-appropriate. Follow safeguarding best practices.',
  }
  return guidance[vertical] || ''
}
