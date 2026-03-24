import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { anthropic } from '@/lib/anthropic'
import { getVerticalSystemPromptGuidance } from '@/lib/utils'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(
    token || (await getTokenFromCookie(req))
  )

  let userId = user?.id
  const { name, description, vertical, workspace_id } = req.body

  if (!name || !description || !vertical) {
    return res.status(400).json({ error: 'Name, description, and vertical are required' })
  }

  // Check agent count limit
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single()

    const planLimits = { free: 3, starter: 10, pro: -1, business: -1 }
    const limit = planLimits[profile?.plan || 'free'] || 3

    if (limit > 0) {
      const { count } = await supabase
        .from('agents')
        .select('id', { count: 'exact' })
        .eq('owner_id', userId)

      if (count >= limit) {
        return res.status(403).json({
          error: 'agent_limit_reached',
          message: `Your ${profile?.plan || 'free'} plan allows ${limit} agents. Upgrade to create more.`,
          upgrade_url: '/pricing',
        })
      }
    }
  }

  const verticalGuidance = getVerticalSystemPromptGuidance(vertical)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are an expert AI agent architect. Create a production-grade agent blueprint for the following:

Name: ${name}
Description: ${description}
Industry: ${vertical}
${verticalGuidance ? `\nIndustry-specific guidance: ${verticalGuidance}` : ''}

Return ONLY valid JSON with no markdown or code blocks. The JSON must have this exact structure:
{
  "system_prompt": "A detailed system prompt of at least 200 words for this agent",
  "purpose": "A one-paragraph description of what this agent does and why it's valuable",
  "trigger": "What triggers this agent to run",
  "steps": ["Step 1 description", "Step 2 description", "..."],
  "integrations": ["Integration 1", "Integration 2"],
  "expected_output": "What the agent produces",
  "tags": ["tag1", "tag2"]
}`,
        },
      ],
    })

    const rawText = message.content[0].text.trim()
    const jsonStr = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    let config
    try {
      config = JSON.parse(jsonStr)
    } catch {
      return res.status(500).json({ error: 'Failed to parse agent blueprint. Please try again.' })
    }

    const { data: agent, error: dbError } = await supabase
      .from('agents')
      .insert({
        name,
        description,
        vertical,
        workspace_id: workspace_id || null,
        owner_id: userId,
        status: 'active',
        config,
        run_count: 0,
      })
      .select()
      .single()

    if (dbError) return res.status(500).json({ error: dbError.message })
    return res.status(200).json(agent)
  } catch (err) {
    console.error('Agent creation error:', err)
    return res.status(500).json({ error: err.message || 'Failed to create agent' })
  }
}

async function getTokenFromCookie(req) {
  const cookies = req.headers.cookie || ''
  const match = cookies.match(/sb-[^=]+-auth-token=([^;]+)/)
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1])
      const parsed = JSON.parse(decoded)
      return parsed?.[0] || parsed?.access_token || null
    } catch { return null }
  }
  return null
}
