import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { document_id, user_id, query, helpful, comment } = req.body

  const { data, error } = await supabase
    .from('knowledge_feedback')
    .insert({ document_id, user_id, query, helpful, comment })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
