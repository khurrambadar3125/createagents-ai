import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, agent_id, status, limit = 50 } = req.query

  if (!user_id) return res.status(400).json({ error: 'user_id is required' })

  let query = supabase
    .from('agent_runs')
    .select('*, agents(name)')
    .eq('user_id', user_id)
    .order('started_at', { ascending: false })
    .limit(Number(limit))

  if (agent_id) query = query.eq('agent_id', agent_id)
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
