import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { search, vertical, complexity, b2b_b2c } = req.query

  let query = supabase
    .from('agents')
    .select('*')
    .is('owner_id', null)
    .order('name')

  if (vertical) query = query.eq('vertical', vertical)

  const { data, error } = await query

  if (error) return res.status(500).json({ error: error.message })

  // Client-side filtering for jsonb fields
  let filtered = data || []

  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter(
      (a) =>
        a.name.toLowerCase().includes(s) ||
        a.description.toLowerCase().includes(s) ||
        (a.config?.tags || []).some((t) => t.toLowerCase().includes(s))
    )
  }

  if (complexity) {
    filtered = filtered.filter((a) => a.config?.complexity === complexity)
  }

  if (b2b_b2c && b2b_b2c !== 'all') {
    filtered = filtered.filter(
      (a) => a.config?.b2b_b2c === b2b_b2c || a.config?.b2b_b2c === 'both'
    )
  }

  return res.status(200).json(filtered)
}
