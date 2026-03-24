import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { anthropic } from '@/lib/anthropic'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Support both API key auth and direct calls (from share page)
  const apiKey = req.headers['x-api-key']
  const { agent_id, user_input } = req.body

  if (!agent_id || !user_input) {
    return res.status(400).json({ error: 'agent_id and user_input are required' })
  }

  try {
    // Load agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    // If API key provided, verify it matches
    if (apiKey && agent.config?.api_key && apiKey !== agent.config.api_key) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    // Check run limits for the owner
    if (agent.owner_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('runs_used, runs_limit, plan')
        .eq('id', agent.owner_id)
        .single()

      if (profile) {
        const limit = profile.runs_limit || 15
        if (limit > 0 && profile.runs_used >= limit) {
          return res.status(403).json({ error: 'Agent owner has reached their run limit.' })
        }
      }
    }

    // Build messages
    const systemPrompt = agent.config?.system_prompt || `You are ${agent.name}. ${agent.description}`

    // Call Claude
    const startTime = Date.now()
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: user_input }],
    })

    const duration_ms = Date.now() - startTime
    const outputText = message.content[0].text
    const tokens_used = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    // Save run
    await supabase.from('agent_runs').insert({
      agent_id,
      user_id: agent.owner_id,
      status: 'completed',
      input: { text: user_input, source: apiKey ? 'api' : 'share' },
      output: { text: outputText },
      duration_ms,
      tokens_used,
      started_at: new Date().toISOString(),
    }).catch(() => {})

    // Increment counters
    await supabase.from('agents').update({ run_count: (agent.run_count || 0) + 1 }).eq('id', agent_id)
    if (agent.owner_id) {
      await supabase.rpc('increment_runs_used', { user_id: agent.owner_id }).catch(async () => {
        // Fallback if RPC doesn't exist
        const { data: p } = await supabase.from('profiles').select('runs_used').eq('id', agent.owner_id).single()
        if (p) await supabase.from('profiles').update({ runs_used: (p.runs_used || 0) + 1 }).eq('id', agent.owner_id)
      })
    }

    // CORS headers for embed usage
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')

    return res.status(200).json({
      output: outputText,
      tokens_used,
      duration_ms,
    })
  } catch (err) {
    console.error('Public run error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
