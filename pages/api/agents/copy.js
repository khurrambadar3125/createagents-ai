import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { template_id, owner_id, workspace_id } = req.body

  if (!template_id || !owner_id) {
    return res.status(400).json({ error: 'template_id and owner_id are required' })
  }

  // Load template
  const { data: template, error: fetchError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', template_id)
    .is('owner_id', null)
    .single()

  if (fetchError || !template) {
    return res.status(404).json({ error: 'Template not found' })
  }

  // Copy into user's workspace
  const { data: agent, error: insertError } = await supabase
    .from('agents')
    .insert({
      name: template.name,
      description: template.description,
      vertical: template.vertical,
      owner_id,
      workspace_id: workspace_id || null,
      status: 'active',
      config: template.config,
      run_count: 0,
    })
    .select()
    .single()

  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  return res.status(200).json(agent)
}
