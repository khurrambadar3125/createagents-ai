import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

/**
 * Returns personalised suggestions for a user based on their activity.
 * This powers the "smart nudges" that help users get more value.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const suggestions = []

  // Get user profile and activity
  const [profileRes, agentsRes, runsRes, filesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user_id).single(),
    supabase.from('agents').select('id, name, vertical, run_count').eq('owner_id', user_id),
    supabase.from('agent_runs').select('id, agent_id, status').eq('user_id', user_id),
    supabase.from('files').select('id').eq('owner_id', user_id),
  ])

  const profile = profileRes.data
  const agents = agentsRes.data || []
  const runs = runsRes.data || []
  const files = filesRes.data || []

  // 1. No agents yet → suggest deploying from library
  if (agents.length === 0) {
    suggestions.push({
      type: 'getting-started',
      priority: 1,
      title: 'Deploy your first agent',
      message: 'Browse 96 ready-to-run agents in the library. One click and it\'s yours.',
      action: '/templates',
      actionLabel: 'Browse Agent Library',
    })
  }

  // 2. Has agents but never run them
  if (agents.length > 0 && runs.length === 0) {
    suggestions.push({
      type: 'first-run',
      priority: 1,
      title: 'Try running your agent',
      message: `${agents[0].name} is ready. Give it a task and see what it can do.`,
      action: `/agent/${agents[0].id}`,
      actionLabel: 'Run It Now',
    })
  }

  // 3. Only 1 agent → suggest adding more
  if (agents.length === 1 && runs.length > 0) {
    const verticals = [...new Set(agents.map(a => a.vertical))]
    suggestions.push({
      type: 'expand',
      priority: 2,
      title: 'Build your agent team',
      message: 'One agent is good. A team of agents is powerful. Add agents for different tasks.',
      action: '/templates',
      actionLabel: 'Add More Agents',
    })
  }

  // 4. No files uploaded → suggest file upload
  if (files.length === 0 && agents.length > 0) {
    suggestions.push({
      type: 'files',
      priority: 3,
      title: 'Give your agents context',
      message: 'Upload documents (PDF, DOCX, CSV) and your agents can use them as context for better answers.',
      action: '/files',
      actionLabel: 'Upload Files',
    })
  }

  // 5. Agent with high run count but no share link used → suggest deploying
  const popularAgent = agents.find(a => a.run_count >= 5)
  if (popularAgent) {
    suggestions.push({
      type: 'deploy',
      priority: 2,
      title: 'Share your best agent',
      message: `${popularAgent.name} has ${popularAgent.run_count} runs. Share it with your team or embed it on your website.`,
      action: `/agent/${popularAgent.id}`,
      actionLabel: 'Get Share Link',
    })
  }

  // 6. On free plan with high usage → suggest upgrade
  if (profile?.plan === 'free' && (profile?.runs_used || 0) >= 10) {
    suggestions.push({
      type: 'upgrade',
      priority: 2,
      title: 'Running out of runs?',
      message: `You've used ${profile.runs_used}/15 free runs. Upgrade for 400+ runs and more agents.`,
      action: '/pricing',
      actionLabel: 'View Plans',
    })
  }

  // 7. Has multiple verticals → suggest specialised agents
  if (agents.length >= 3) {
    const verticals = [...new Set(agents.map(a => a.vertical))]
    if (verticals.length === 1) {
      suggestions.push({
        type: 'diversify',
        priority: 3,
        title: 'Explore other industries',
        message: 'All your agents are in one vertical. Try agents for different areas to unlock more value.',
        action: '/templates',
        actionLabel: 'Explore Verticals',
      })
    }
  }

  // Sort by priority
  suggestions.sort((a, b) => a.priority - b.priority)

  return res.status(200).json(suggestions.slice(0, 3))
}
