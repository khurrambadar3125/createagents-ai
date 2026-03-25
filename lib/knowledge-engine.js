import { supabaseAdmin } from './supabaseAdmin'

/**
 * Generate a semantic embedding using OpenAI's API.
 * Falls back gracefully to null if no API key — keyword search is used instead.
 */
export async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
    })
    const data = await res.json()
    return data.data?.[0]?.embedding || null
  } catch (err) {
    console.error('Embedding failed:', err.message)
    return null
  }
}

/**
 * Chunk a document into overlapping semantic units.
 * Preserves paragraph boundaries with 50-word overlap between chunks.
 */
export function chunkDocument(text, maxWords = 400) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 20)
  if (paragraphs.length === 0) return [text.trim()]

  const chunks = []
  let current = ''
  let overlapBuffer = ''

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para
    const wordCount = combined.split(/\s+/).length

    if (wordCount > maxWords && current) {
      chunks.push(current.trim())
      // Keep last 50 words as overlap
      const words = current.split(/\s+/)
      overlapBuffer = words.slice(Math.max(0, words.length - 50)).join(' ')
      current = overlapBuffer + '\n\n' + para
    } else {
      current = combined
    }
  }
  if (current.trim()) chunks.push(current.trim())
  if (chunks.length === 0) chunks.push(text.trim())

  return chunks
}

/**
 * Ingest a document — chunk, optionally embed, store in Supabase.
 */
export async function ingestDocument({ title, content, domain, subdomain, vertical, source_type, language, region, tags, compliance_standards }) {
  const chunks = chunkDocument(content)
  const rows = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = await generateEmbedding(`${title}. ${chunk}`)

    rows.push({
      title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
      content: chunk,
      domain: domain || 'general',
      subdomain: subdomain || null,
      vertical: vertical || null,
      source_type: source_type || 'best_practice',
      language: language || 'en',
      region: region || 'global',
      tags: tags || [],
      compliance_standards: compliance_standards || [],
      embedding,
      chunk_index: i,
      total_chunks: chunks.length,
      word_count: chunk.split(/\s+/).length,
      quality_score: 0.85,
    })
  }

  const { data, error } = await supabaseAdmin
    .from('knowledge_documents')
    .insert(rows)
    .select('id, title')

  if (error) throw new Error(`Ingest failed: ${error.message}`)
  return { chunks_stored: data?.length || 0, titles: data?.map((d) => d.title) }
}

/**
 * Search knowledge base — hybrid (vector+keyword) or keyword-only fallback.
 */
export async function searchKnowledge(query, { vertical, domain, limit = 8 } = {}) {
  // Try hybrid search first (needs embeddings)
  const embedding = await generateEmbedding(query)

  if (embedding) {
    try {
      const { data, error } = await supabaseAdmin.rpc('hybrid_knowledge_search', {
        query_text: query,
        query_embedding: embedding,
        match_count: limit,
      })
      if (!error && data?.length > 0) return data
    } catch {}
  }

  // Fallback: keyword search via RPC
  try {
    const { data, error } = await supabaseAdmin.rpc('keyword_knowledge_search', {
      query_text: query,
      match_count: limit,
      filter_vertical: vertical || null,
      filter_domain: domain || null,
    })
    if (!error && data?.length > 0) return data
  } catch {}

  // Final fallback: simple ilike search
  let q = supabaseAdmin
    .from('knowledge_documents')
    .select('id, title, content, domain, vertical, source_type')
    .or(`title.ilike.%${query.split(' ').slice(0, 3).join('%')}%,content.ilike.%${query.split(' ').slice(0, 3).join('%')}%`)
    .limit(limit)

  if (vertical) q = q.eq('vertical', vertical)
  if (domain) q = q.eq('domain', domain)

  const { data } = await q
  return (data || []).map((d) => ({ ...d, score: 0.5 }))
}

/**
 * Get formatted context for Claude prompt injection.
 * This is the main function used by all API routes.
 */
export async function getContext(query, { vertical, maxTokens = 3000 } = {}) {
  const results = await searchKnowledge(query, { vertical, limit: 8 })
  if (!results.length) return ''

  let context = ''
  let tokenEstimate = 0

  for (const doc of results) {
    const entry = `[${doc.domain}${doc.source_type ? ` — ${doc.source_type}` : ''}] ${doc.title}\n${doc.content}\n`
    const entryTokens = entry.split(/\s+/).length * 1.3

    if (tokenEstimate + entryTokens > maxTokens) break
    context += entry + '\n---\n\n'
    tokenEstimate += entryTokens
  }

  return context.trim()
}

// Alias for backwards compatibility
export const getContextForPrompt = getContext
