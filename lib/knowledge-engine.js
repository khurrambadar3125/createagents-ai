import { supabaseAdmin } from './supabaseAdmin'

/**
 * Generate embedding using OpenAI's API.
 * Falls back to null if no API key (keyword search will be used instead).
 */
export async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // Limit input
      }),
    })
    const data = await res.json()
    return data.data?.[0]?.embedding || null
  } catch (err) {
    console.error('Embedding generation failed:', err.message)
    return null
  }
}

/**
 * Chunk a document into semantic units (paragraph-based).
 */
export function chunkDocument(text, maxWords = 500) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 30)
  const chunks = []
  let current = ''

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para
    const wordCount = combined.split(/\s+/).length

    if (wordCount > maxWords && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current = combined
    }
  }

  if (current.trim()) chunks.push(current.trim())

  // If no good chunks, just return the full text
  if (chunks.length === 0) chunks.push(text.trim())

  return chunks
}

/**
 * Ingest a document — chunk, embed, store.
 */
export async function ingestDocument({ title, content, domain, subdomain, vertical, source_type, tags, language, region, compliance_standards }) {
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
    })
  }

  const { data, error } = await supabaseAdmin
    .from('knowledge_documents')
    .insert(rows)
    .select('id, title')

  if (error) throw new Error(`Ingest failed: ${error.message}`)
  return data
}

/**
 * Search knowledge base — uses hybrid search (vector + keyword) if embeddings available,
 * falls back to keyword-only search.
 */
export async function searchKnowledge(query, { vertical, domain, language = 'en', limit = 8 } = {}) {
  const embedding = await generateEmbedding(query)

  if (embedding) {
    // Hybrid search
    const { data, error } = await supabaseAdmin.rpc('hybrid_knowledge_search', {
      query_text: query,
      query_embedding: embedding,
      match_count: limit,
    })

    if (!error && data?.length > 0) return data
  }

  // Fallback: keyword search
  const { data, error } = await supabaseAdmin.rpc('keyword_knowledge_search', {
    query_text: query,
    match_count: limit,
    filter_vertical: vertical || null,
    filter_domain: domain || null,
  })

  if (error) {
    console.error('Knowledge search failed:', error.message)
    return []
  }

  return data || []
}

/**
 * Get formatted context for Claude prompt injection.
 * Retrieves the most relevant knowledge and formats it for the system prompt.
 */
export async function getContext(query, { vertical, maxTokens = 4000 } = {}) {
  const results = await searchKnowledge(query, { vertical, limit: 8 })

  if (!results.length) return ''

  let context = ''
  let tokenEstimate = 0

  for (const doc of results) {
    const entry = `[${doc.domain}${doc.source_type ? ` — ${doc.source_type}` : ''}]\n${doc.title}\n${doc.content}\n`
    const entryTokens = entry.split(/\s+/).length * 1.3 // rough token estimate

    if (tokenEstimate + entryTokens > maxTokens) break

    context += entry + '\n---\n\n'
    tokenEstimate += entryTokens
  }

  return context.trim()
}
