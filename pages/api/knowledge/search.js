import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { q, domain, vertical, limit = 20, offset = 0 } = req.query

  let query = supabase
    .from('knowledge_documents')
    .select('id, title, domain, subdomain, vertical, source_type, tags, word_count, quality_score, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (domain) query = query.eq('domain', domain)
  if (vertical) query = query.eq('vertical', vertical)
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)

  const { data, error, count } = await query

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ data, total: count })
}
