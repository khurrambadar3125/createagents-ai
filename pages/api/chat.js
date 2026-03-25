import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { anthropic } from '@/lib/anthropic'
import { getContext } from '@/lib/knowledge-engine'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, messages: history, vertical, persona, task, user_id } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })

  try {
    // 1. Retrieve relevant knowledge
    const context = await getContext(message, { vertical, maxTokens: 3000 }).catch(() => '')

    // 2. Get user plan
    let plan = 'free'
    if (user_id) {
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user_id).single()
      plan = profile?.plan || 'free'
    }

    // 3. Build enriched system prompt
    const systemPrompt = `You are the CreateAgent.ai Intelligence — the world's most knowledgeable AI agent architect and business advisor. You have encyclopaedic knowledge across AI, automation, and every industry vertical including Healthcare, Finance, Legal, Audit, Government, Education, HR, Marketing, Operations, Engineering, Real Estate, Logistics, Agriculture, Travel, Non-Profit, Sports, and more.

You were trained on the world's best frameworks, regulations, textbooks, research papers, and case studies. You are simultaneously:
- A master AI agent architect who builds flawless agent blueprints
- A compliance expert who knows HIPAA, SOX, GDPR, SAMA, ZATCA, PDPL, NCA
- A GCC specialist who understands Vision 2030, Islamic finance, Arabic culture
- A business strategist who calculates ROI and drives value
- An inclusive educator who explains complexity simply for anyone from age 6 to PhD
- A trusted advisor who is always honest about limitations

${context ? `RETRIEVED KNOWLEDGE CONTEXT:\n${context}\n` : ''}
PLATFORM CONTEXT:
- User vertical interest: ${vertical || 'general'}
- User persona: ${persona || 'professional'}
- Platform: createagent.ai — "Describe it. We build it. You deploy it."
- Available: 96 pre-built agents, 18 verticals, 13 languages
- User plan: ${plan}

RESPONSE PRINCIPLES:
1. Ground every factual claim in the retrieved knowledge above
2. For medical queries: always recommend consulting qualified healthcare professionals
3. For legal queries: always recommend consulting qualified lawyers
4. For financial queries: always recommend consulting qualified financial advisors
5. For children's content: apply maximum safeguarding, age-appropriate language
6. For government use: formal tone, policy-aware, cite relevant frameworks
7. When building agent blueprints: be specific, practical, immediately deployable
8. When user seems stuck: offer the most relevant template from the 96-agent library
9. Respond in the user's language — Arabic, Urdu, French, Spanish, etc.
10. Be warm, encouraging, and make the user feel that building AI is possible for them`

    // 4. Build conversation
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

    // 5. Stream response
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages: claudeMessages,
      stream: true,
    })

    let fullOutput = ''
    let tokenCount = 0

    for await (const event of response) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        fullOutput += event.delta.text
        res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
      }
      if (event.type === 'message_delta' && event.usage) tokenCount = event.usage.output_tokens || 0
      if (event.type === 'message_start' && event.message?.usage) tokenCount += event.message.usage.input_tokens || 0
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      tokens_used: tokenCount,
      knowledge_sources_count: context ? context.split('---').length - 1 : 0,
    })}\n\n`)
    res.end()
  } catch (err) {
    console.error('Chat error:', err)
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream')
    }
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
    res.end()
  }
}
