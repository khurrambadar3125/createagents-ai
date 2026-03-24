import { createClient } from '@supabase/supabase-js'
import { anthropic } from '@/lib/anthropic'
import { getVerticalSystemPromptGuidance } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies['sb-access-token']
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    token || (await getTokenFromCookie(req))
  )

  // For development/testing, also try session-based auth
  let userId = user?.id
  if (!userId) {
    // Try extracting from supabase session cookie
    const authHeader = req.headers.cookie
    if (authHeader) {
      const sbAuth = authHeader.split(';').find(c => c.trim().startsWith('sb-'))
      if (sbAuth) {
        // Fallback: use the anon key approach with RLS
      }
    }
  }

  const { name, description, vertical, workspace_id } = req.body

  if (!name || !description || !vertical) {
    return res.status(400).json({ error: 'Name, description, and vertical are required' })
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
  "system_prompt": "A detailed system prompt for this agent",
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
    // Strip any markdown code blocks if present
    const jsonStr = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    let config
    try {
      config = JSON.parse(jsonStr)
    } catch {
      return res.status(500).json({ error: 'Failed to parse agent blueprint. Please try again.' })
    }

    // Save to database
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

    if (dbError) {
      return res.status(500).json({ error: dbError.message })
    }

    return res.status(200).json(agent)
  } catch (err) {
    console.error('Agent creation error:', err)
    return res.status(500).json({ error: err.message || 'Failed to create agent' })
  }
}

async function getTokenFromCookie(req) {
  // Extract Supabase auth token from cookies
  const cookies = req.headers.cookie || ''
  const match = cookies.match(/sb-[^=]+-auth-token=([^;]+)/)
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1])
      const parsed = JSON.parse(decoded)
      return parsed?.[0] || parsed?.access_token || null
    } catch {
      return null
    }
  }
  return null
}
