import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { anthropic } from '@/lib/anthropic'
import { getContext } from '@/lib/knowledge-engine'
import { handleMemoryToolUse, MEMORY_SYSTEM_PROMPT } from '@/lib/memory/memoryTool'

const STEP_INSTRUCTION = `

IMPORTANT: When handling complex tasks, work through them step by step. Begin each major step with a line like:

**Step 1: [what you're doing]**

This helps the user follow your reasoning. For simple questions, respond directly without steps.`

const MEMORY_TOOL_DEFINITION = {
  name: 'memory',
  type: 'custom',
  description: 'Persistent memory storage. Use to remember facts about the user across conversations. Commands: view (list/read), create, str_replace, insert, delete, rename.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: ['view', 'create', 'str_replace', 'insert', 'delete', 'rename'],
        description: 'The memory operation to perform',
      },
      file_path: {
        type: 'string',
        description: 'Path to the file, must start with /memories',
      },
      content: {
        type: 'string',
        description: 'File content (for create command)',
      },
      old_str: {
        type: 'string',
        description: 'String to find (for str_replace)',
      },
      new_str: {
        type: 'string',
        description: 'Replacement string (for str_replace and insert)',
      },
      insert_line: {
        type: 'number',
        description: 'Line number to insert at (for insert)',
      },
      new_file_path: {
        type: 'string',
        description: 'New path (for rename)',
      },
    },
    required: ['command', 'file_path'],
  },
}

// Max tool-use iterations to prevent infinite loops
const MAX_TOOL_TURNS = 10

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { agent_id, user_input, messages: conversationHistory, file_ids, stream, visitor_id } = req.body

  if (!agent_id || (!user_input && !conversationHistory?.length)) {
    return res.status(400).json({ error: 'agent_id and user_input (or messages) are required' })
  }

  // visitor_id scopes memory — defaults to 'default' for backwards compatibility
  const effectiveVisitorId = visitor_id || 'default'

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

    // 4. Build system prompt with knowledge + memory protocol + step instruction
    const basePrompt = agent.config?.system_prompt || `You are ${agent.name}. ${agent.description}`
    const userQuery = user_input || conversationHistory?.slice(-1)?.[0]?.text || ''
    const knowledgeContext = await getContext(userQuery, { vertical: agent.vertical, maxTokens: 2000 }).catch(() => '')
    const systemPrompt = basePrompt
      + (knowledgeContext ? `\n\nRELEVANT KNOWLEDGE:\n${knowledgeContext}` : '')
      + MEMORY_SYSTEM_PROMPT
      + STEP_INSTRUCTION

    // 5. Build messages — support conversation history
    let claudeMessages = []

    if (conversationHistory?.length > 0) {
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

    // 6. Call Claude with memory tool — handle tool-use loop
    if (stream) {
      await handleStreamingWithMemory(req, res, agent, agent_id, profile, systemPrompt, claudeMessages, effectiveVisitorId, startTime, user_input, conversationHistory)
    } else {
      await handleStandardWithMemory(res, agent, agent_id, profile, systemPrompt, claudeMessages, effectiveVisitorId, startTime, user_input)
    }
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

/**
 * Standard (non-streaming) response with memory tool loop.
 * Claude may call the memory tool multiple times before producing a final text response.
 */
async function handleStandardWithMemory(res, agent, agent_id, profile, systemPrompt, messages, visitorId, startTime, userInput) {
  let currentMessages = [...messages]
  let totalTokens = 0

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: currentMessages,
      tools: [MEMORY_TOOL_DEFINITION],
    })

    totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)

    // Check if response contains tool use
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    const textBlocks = response.content.filter(b => b.type === 'text')

    if (toolUseBlocks.length === 0) {
      // No tool calls — this is the final response
      const outputText = textBlocks.map(b => b.text).join('')
      const duration_ms = Date.now() - startTime

      await saveRun(supabase, agent_id, agent, profile, userInput, outputText, duration_ms, totalTokens)

      return res.status(200).json({
        output: outputText,
        tokens_used: totalTokens,
        duration_ms,
        memory_enabled: true,
      })
    }

    // Handle tool calls — add assistant response + tool results to messages
    currentMessages.push({ role: 'assistant', content: response.content })

    const toolResults = []
    for (const toolBlock of toolUseBlocks) {
      if (toolBlock.name === 'memory') {
        const result = await handleMemoryToolUse(agent_id, visitorId, toolBlock.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result.error
            ? JSON.stringify({ error: result.error })
            : result.content,
        })
      }
    }

    currentMessages.push({ role: 'user', content: toolResults })

    // If stop_reason is 'end_turn', Claude is done even with tool use in the same response
    if (response.stop_reason === 'end_turn' && textBlocks.length > 0) {
      const outputText = textBlocks.map(b => b.text).join('')
      const duration_ms = Date.now() - startTime

      await saveRun(supabase, agent_id, agent, profile, userInput, outputText, duration_ms, totalTokens)

      return res.status(200).json({
        output: outputText,
        tokens_used: totalTokens,
        duration_ms,
        memory_enabled: true,
      })
    }
  }

  // Safety: exceeded max tool turns
  const duration_ms = Date.now() - startTime
  await saveRun(supabase, agent_id, agent, profile, userInput, '[Memory tool loop exceeded maximum turns]', duration_ms, totalTokens)
  return res.status(200).json({
    output: 'I processed your request but had to stop the memory operations early. Please try again.',
    tokens_used: totalTokens,
    duration_ms,
    memory_enabled: true,
  })
}

/**
 * Streaming response with memory tool loop.
 * Tool-use turns happen silently (not streamed). Final text response is streamed.
 */
async function handleStreamingWithMemory(req, res, agent, agent_id, profile, systemPrompt, messages, visitorId, startTime, userInput, conversationHistory) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  let currentMessages = [...messages]
  let totalTokens = 0

  // Phase 1: Handle memory tool calls silently (non-streaming)
  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: currentMessages,
      tools: [MEMORY_TOOL_DEFINITION],
    })

    totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')

    if (toolUseBlocks.length === 0) {
      // No more tool calls — now stream the final text
      break
    }

    // Handle tool calls
    currentMessages.push({ role: 'assistant', content: response.content })

    const toolResults = []
    for (const toolBlock of toolUseBlocks) {
      if (toolBlock.name === 'memory') {
        const result = await handleMemoryToolUse(agent_id, visitorId, toolBlock.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result.error
            ? JSON.stringify({ error: result.error })
            : result.content,
        })
      }
    }

    currentMessages.push({ role: 'user', content: toolResults })

    // If stop_reason is 'end_turn' with text, break to stream
    const textBlocks = response.content.filter(b => b.type === 'text')
    if (response.stop_reason === 'end_turn' && textBlocks.length > 0) {
      // Stream the text we already have
      const text = textBlocks.map(b => b.text).join('')
      res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
      const duration_ms = Date.now() - startTime
      res.write(`data: ${JSON.stringify({ type: 'done', tokens_used: totalTokens, duration_ms, memory_enabled: true })}\n\n`)
      res.end()
      saveRun(supabase, agent_id, agent, profile, userInput || conversationHistory?.slice(-1)?.[0]?.text, text, duration_ms, totalTokens)
      return
    }
  }

  // Phase 2: Stream the final response
  let fullOutput = ''

  const streamResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: systemPrompt,
    messages: currentMessages,
    tools: [MEMORY_TOOL_DEFINITION],
    stream: true,
  })

  for await (const event of streamResponse) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      fullOutput += event.delta.text
      res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
    }
    if (event.type === 'message_delta' && event.usage) {
      totalTokens += event.usage.output_tokens || 0
    }
    if (event.type === 'message_start' && event.message?.usage) {
      totalTokens += event.message.usage.input_tokens || 0
    }
  }

  const duration_ms = Date.now() - startTime

  res.write(`data: ${JSON.stringify({ type: 'done', tokens_used: totalTokens, duration_ms, memory_enabled: true })}\n\n`)
  res.end()

  saveRun(supabase, agent_id, agent, profile, userInput || conversationHistory?.slice(-1)?.[0]?.text, fullOutput, duration_ms, totalTokens)
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
