import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { anthropic } from '@/lib/anthropic'
import { getContext } from '@/lib/knowledge-engine'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, messages: history, vertical, persona, task, user_id } = req.body

  if (!message) return res.status(400).json({ error: 'message is required' })

  try {
    // Get relevant knowledge context
    const knowledgeContext = await getContext(message, { vertical }).catch(() => '')

    // Get user plan info
    let plan = 'free'
    if (user_id) {
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user_id).single()
      plan = profile?.plan || 'free'
    }

    const systemPrompt = `You are the CreateAgent.ai Intelligence — the world's most knowledgeable AI agent architect. You have encyclopaedic knowledge across AI, automation, and every industry vertical.

You are:
- A master prompt engineer who builds flawless agent blueprints
- A compliance expert who knows HIPAA, SOX, GDPR, SAMA, ZATCA
- A business strategist who understands ROI and value creation
- An educator who explains complex concepts simply
- A trusted advisor who is honest about limitations

${knowledgeContext ? `RELEVANT KNOWLEDGE:\n${knowledgeContext}\n` : ''}
PLATFORM CONTEXT:
- User vertical: ${vertical || 'general'}
- User persona: ${persona || 'professional'}
- Current task: ${task || 'general assistance'}
- User plan: ${plan}

RULES:
- Always ground answers in retrieved knowledge when available
- For medical/legal/financial queries: advise consulting professionals
- For children's content: apply COPPA/GDPR-K safeguards
- For government: apply formal, policy-aware tone
- Suggest relevant agents from the platform when helpful
- Respond in the user's language if not English
- Be concise but thorough. Use step-by-step format for complex topics.`

    // Build conversation
    const claudeMessages = []
    if (history?.length > 0) {
      for (const m of history) {
        claudeMessages.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.text || m.content,
        })
      }
    }
    claudeMessages.push({ role: 'user', content: message })

    // Stream response
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: claudeMessages,
      stream: true,
    })

    let fullOutput = ''
    for await (const event of response) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        fullOutput += event.delta.text
        res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', sources: knowledgeContext ? 'knowledge-base' : 'general' })}\n\n`)
    res.end()
  } catch (err) {
    console.error('Chat error:', err)
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
    res.end()
  }
}
