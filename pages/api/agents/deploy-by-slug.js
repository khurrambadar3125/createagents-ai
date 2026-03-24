import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { slug, owner_id } = req.body
  if (!slug || !owner_id) return res.status(400).json({ error: 'slug and owner_id required' })

  // Find template by slugified name
  const searchName = slug.replace(/-/g, ' ')
  const { data: templates } = await supabase
    .from('agents')
    .select('*')
    .is('owner_id', null)
    .ilike('name', `%${searchName}%`)
    .limit(1)

  if (!templates || templates.length === 0) {
    return res.status(404).json({ error: 'Template not found' })
  }

  const template = templates[0]
  const newConfig = { ...template.config }
  delete newConfig.is_template

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      name: template.name,
      description: template.description,
      vertical: template.vertical,
      owner_id,
      workspace_id: null,
      status: 'active',
      config: newConfig,
      run_count: 0,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(agent)
}
