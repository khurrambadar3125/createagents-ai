import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { anthropic } from '@/lib/anthropic'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { agent_id, user_input, file_ids } = req.body

  if (!agent_id || !user_input) {
    return res.status(400).json({ error: 'agent_id and user_input are required' })
  }

  try {
    // 1. Load agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    // 2. Load profile and check run limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', agent.owner_id)
      .single()

    if (profile) {
      const runsLimit = profile.runs_limit || 15
      if (runsLimit > 0 && profile.runs_used >= runsLimit) {
        return res.status(403).json({
          error: 'limit_reached',
          message: 'Monthly run limit reached. Upgrade your plan to continue.',
          plan: profile.plan,
          runs_used: profile.runs_used,
          runs_limit: runsLimit,
          upgrade_url: '/pricing',
        })
      }
    }

    // 3. Build context from files if provided
    let fileContext = ''
    if (file_ids && file_ids.length > 0) {
      const { data: files } = await supabase
        .from('files')
        .select('name, extracted_text')
        .in('id', file_ids)
        .eq('processed', true)

      if (files && files.length > 0) {
        fileContext = files
          .map((f) => `--- File: ${f.name} ---\n${f.extracted_text}`)
          .join('\n\n')
      }
    }

    // 4. Build messages
    const systemPrompt = agent.config?.system_prompt || `You are ${agent.name}. ${agent.description}`
    const userMessage = fileContext
      ? `Context from uploaded files:\n\n${fileContext}\n\n---\n\nUser request: ${user_input}`
      : user_input

    // 5. Call Claude
    const startTime = Date.now()

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const duration_ms = Date.now() - startTime
    const outputText = message.content[0].text
    const tokens_used = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    // 6. Save run
    const { data: run, error: runError } = await supabase
      .from('agent_runs')
      .insert({
        agent_id,
        user_id: agent.owner_id,
        status: 'completed',
        input: { text: user_input, file_ids: file_ids || [] },
        output: { text: outputText },
        duration_ms,
        tokens_used,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (runError) console.error('Failed to save run:', runError)

    // 7. Increment counters
    await supabase
      .from('agents')
      .update({ run_count: (agent.run_count || 0) + 1 })
      .eq('id', agent_id)

    if (profile) {
      await supabase
        .from('profiles')
        .update({ runs_used: (profile.runs_used || 0) + 1 })
        .eq('id', profile.id)
    }

    // 8. Return result
    return res.status(200).json({
      output: outputText,
      tokens_used,
      duration_ms,
      run_id: run?.id,
    })
  } catch (err) {
    // Save failed run
    await supabase.from('agent_runs').insert({
      agent_id,
      user_id: null,
      status: 'failed',
      input: { text: user_input },
      output: { error: err.message },
      started_at: new Date().toISOString(),
    }).catch(() => {})

    console.error('Agent run error:', err)
    return res.status(500).json({ error: err.message || 'Agent run failed' })
  }
}
