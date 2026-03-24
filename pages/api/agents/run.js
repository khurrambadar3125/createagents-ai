import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { anthropic } from '@/lib/anthropic'
import { getContext } from '@/lib/knowledge-engine'

const STEP_INSTRUCTION = `

IMPORTANT: When handling complex tasks, work through them step by step. Begin each major step with a line like:

**Step 1: [what you're doing]**

This helps the user follow your reasoning. For simple questions, respond directly without steps.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { agent_id, user_input, messages: conversationHistory, file_ids, stream } = req.body

  if (!agent_id || (!user_input && !conversationHistory?.length)) {
    return res.status(400).json({ error: 'agent_id and user_input (or messages) are required' })
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

    // 2. Check run limits
    const { data: profile } = agent.owner_id
      ? await supabase.from('profiles').select('*').eq('id', agent.owner_id).single()
      : { data: null }

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

    // 3. File context
    let fileContext = ''
    if (file_ids?.length > 0) {
      const { data: files } = await supabase
        .from('files')
        .select('name, extracted_text')
        .in('id', file_ids)
        .eq('processed', true)
      if (files?.length > 0) {
        fileContext = files.map((f) => `--- File: ${f.name} ---\n${f.extracted_text}`).join('\n\n')
      }
    }

    // 4. Build system prompt with knowledge injection + step-by-step instruction
    const basePrompt = agent.config?.system_prompt || `You are ${agent.name}. ${agent.description}`
    const userQuery = user_input || conversationHistory?.slice(-1)?.[0]?.text || ''
    const knowledgeContext = await getContext(userQuery, { vertical: agent.vertical, maxTokens: 2000 }).catch(() => '')
    const systemPrompt = basePrompt
      + (knowledgeContext ? `\n\nRELEVANT KNOWLEDGE:\n${knowledgeContext}` : '')
      + STEP_INSTRUCTION

    // 5. Build messages — support conversation history
    let claudeMessages = []

    if (conversationHistory?.length > 0) {
      // Use full conversation history for memory
      claudeMessages = conversationHistory.map((m) => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text,
      }))
    }

    // Add current message
    if (user_input) {
      const userMessage = fileContext
        ? `Context from uploaded files:\n\n${fileContext}\n\n---\n\n${user_input}`
        : user_input
      claudeMessages.push({ role: 'user', content: userMessage })
    }

    const startTime = Date.now()

    // 6. Streaming or standard response
    if (stream) {
      // Server-Sent Events streaming
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
        if (event.type === 'message_delta' && event.usage) {
          tokenCount = (event.usage.output_tokens || 0)
        }
        if (event.type === 'message_start' && event.message?.usage) {
          tokenCount += event.message.usage.input_tokens || 0
        }
      }

      const duration_ms = Date.now() - startTime

      // Send final metadata
      res.write(`data: ${JSON.stringify({ type: 'done', tokens_used: tokenCount, duration_ms })}\n\n`)
      res.end()

      // Save run async
      saveRun(supabase, agent_id, agent, profile, user_input || conversationHistory?.slice(-1)?.[0]?.text, fullOutput, duration_ms, tokenCount)
      return
    }

    // Standard (non-streaming) response
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: claudeMessages,
    })

    const duration_ms = Date.now() - startTime
    const outputText = message.content[0].text
    const tokens_used = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    // Save run
    await saveRun(supabase, agent_id, agent, profile, user_input, outputText, duration_ms, tokens_used)

    return res.status(200).json({
      output: outputText,
      tokens_used,
      duration_ms,
    })
  } catch (err) {
    if (req.body.stream) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
      res.end()
      return
    }

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

async function saveRun(supabase, agent_id, agent, profile, inputText, outputText, duration_ms, tokens_used) {
  await supabase.from('agent_runs').insert({
    agent_id,
    user_id: agent.owner_id,
    status: 'completed',
    input: { text: inputText },
    output: { text: outputText },
    duration_ms,
    tokens_used,
    started_at: new Date().toISOString(),
  }).catch(() => {})

  await supabase.from('agents').update({ run_count: (agent.run_count || 0) + 1 }).eq('id', agent_id)

  if (profile) {
    await supabase.from('profiles').update({ runs_used: (profile.runs_used || 0) + 1 }).eq('id', profile.id)
  }
}
