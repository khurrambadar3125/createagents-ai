import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data: docs } = await supabase
    .from('knowledge_documents')
    .select('domain, vertical, source_type, word_count')

  if (!docs) return res.status(200).json({ total: 0, by_domain: {}, by_vertical: {}, by_type: {} })

  const by_domain = {}
  const by_vertical = {}
  const by_type = {}
  let totalWords = 0

  for (const d of docs) {
    by_domain[d.domain] = (by_domain[d.domain] || 0) + 1
    if (d.vertical) by_vertical[d.vertical] = (by_vertical[d.vertical] || 0) + 1
    by_type[d.source_type] = (by_type[d.source_type] || 0) + 1
    totalWords += d.word_count || 0
  }

  return res.status(200).json({
    total: docs.length,
    total_words: totalWords,
    by_domain,
    by_vertical,
    by_type,
  })
}
