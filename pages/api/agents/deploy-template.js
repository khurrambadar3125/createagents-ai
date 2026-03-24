import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { sendAgentDeployedEmail } from '@/lib/email'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { template_id, owner_id, workspace_id } = req.body

  if (!template_id || !owner_id) {
    return res.status(400).json({ error: 'template_id and owner_id are required' })
  }

  // Check agent count limit
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', owner_id)
    .single()

  if (profile) {
    const planLimits = { free: 3, starter: 10, pro: -1, business: -1 }
    const limit = planLimits[profile.plan || 'free'] || 3
    if (limit > 0) {
      const { count } = await supabase
        .from('agents')
        .select('id', { count: 'exact' })
        .eq('owner_id', owner_id)
      if (count >= limit) {
        return res.status(403).json({
          error: 'agent_limit_reached',
          message: `Your ${profile.plan || 'free'} plan allows ${limit} agents. Upgrade to add more.`,
          upgrade_url: '/pricing',
        })
      }
    }
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

  // Deep copy into user workspace
  const newConfig = { ...template.config }
  delete newConfig.is_template

  const { data: agent, error: insertError } = await supabase
    .from('agents')
    .insert({
      name: template.name,
      description: template.description,
      vertical: template.vertical,
      owner_id,
      workspace_id: workspace_id || null,
      status: 'active',
      config: newConfig,
      run_count: 0,
    })
    .select()
    .single()

  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  // Send deployment email (async, don't block)
  if (profile?.email) {
    sendAgentDeployedEmail(
      profile.email,
      profile.full_name,
      template.name,
      agent.id,
      template.vertical
    ).catch(() => {})
  }

  return res.status(200).json(agent)
}
