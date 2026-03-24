import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { anthropic } from '@/lib/anthropic'

const STEP_INSTRUCTION = `

IMPORTANT: When handling complex tasks, work through them step by step. Begin each major step with a line like:

**Step 1: [what you're doing]**

This helps the user follow your reasoning. For simple questions, respond directly without steps.`

export default async function handler(req, res) {
  // CORS for embed usage
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { agent_id, user_input, messages: conversationHistory, stream } = req.body

  if (!agent_id || (!user_input && !conversationHistory?.length)) {
    return res.status(400).json({ error: 'agent_id and user_input are required' })
  }

  try {
    const { data: agent } = await supabase.from('agents').select('*').eq('id', agent_id).single()
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    // Check limits
    if (agent.owner_id) {
      const { data: profile } = await supabase.from('profiles').select('runs_used, runs_limit').eq('id', agent.owner_id).single()
      if (profile && profile.runs_limit > 0 && profile.runs_used >= profile.runs_limit) {
        return res.status(403).json({ error: 'Agent owner has reached their run limit.' })
      }
    }

    const basePrompt = agent.config?.system_prompt || `You are ${agent.name}. ${agent.description}`
    const systemPrompt = basePrompt + STEP_INSTRUCTION

    // Build messages with conversation history
    let claudeMessages = []
    if (conversationHistory?.length > 0) {
      claudeMessages = conversationHistory.map((m) => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text,
      }))
    }
    if (user_input) {
      claudeMessages.push({ role: 'user', content: user_input })
    }

    const startTime = Date.now()

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      let fullOutput = ''
      let tokenCount = 0

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt,
        messages: claudeMessages,
        stream: true,
      })

      for await (const event of response) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          fullOutput += event.delta.text
          res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
        }
        if (event.type === 'message_delta' && event.usage) tokenCount = event.usage.output_tokens || 0
        if (event.type === 'message_start' && event.message?.usage) tokenCount += event.message.usage.input_tokens || 0
      }

      const duration_ms = Date.now() - startTime
      res.write(`data: ${JSON.stringify({ type: 'done', tokens_used: tokenCount, duration_ms })}\n\n`)
      res.end()

      // Save async
      saveRun(agent_id, agent, user_input || conversationHistory?.slice(-1)?.[0]?.text, fullOutput, duration_ms, tokenCount)
      return
    }

    // Non-streaming
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: claudeMessages,
    })

    const duration_ms = Date.now() - startTime
    const outputText = message.content[0].text
    const tokens_used = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    saveRun(agent_id, agent, user_input, outputText, duration_ms, tokens_used)

    return res.status(200).json({ output: outputText, tokens_used, duration_ms })
  } catch (err) {
    if (stream) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
      res.end()
      return
    }
    return res.status(500).json({ error: err.message })
  }
}

async function saveRun(agent_id, agent, inputText, outputText, duration_ms, tokens_used) {
  await supabase.from('agent_runs').insert({
    agent_id,
    user_id: agent.owner_id,
    status: 'completed',
    input: { text: inputText, source: 'public' },
    output: { text: outputText },
    duration_ms,
    tokens_used,
    started_at: new Date().toISOString(),
  }).catch(() => {})

  await supabase.from('agents').update({ run_count: (agent.run_count || 0) + 1 }).eq('id', agent_id)

  if (agent.owner_id) {
    const { data: p } = await supabase.from('profiles').select('runs_used').eq('id', agent.owner_id).single()
    if (p) await supabase.from('profiles').update({ runs_used: (p.runs_used || 0) + 1 }).eq('id', agent.owner_id)
  }
}
