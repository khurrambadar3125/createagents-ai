import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { sendSessionRecapEmail } from '@/lib/email'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user_id)
    .single()

  if (!profile?.email) return res.status(200).json({ skipped: true })

  // Get today's activity
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const [agentsRes, runsRes, filesRes] = await Promise.all([
    supabase.from('agents').select('id', { count: 'exact' }).eq('owner_id', user_id).gte('created_at', todayISO),
    supabase.from('agent_runs').select('id', { count: 'exact' }).eq('user_id', user_id).gte('started_at', todayISO),
    supabase.from('files').select('id', { count: 'exact' }).eq('owner_id', user_id).gte('created_at', todayISO),
  ])

  const activities = {
    agentsCreated: agentsRes.count || 0,
    runsCompleted: runsRes.count || 0,
    filesUploaded: filesRes.count || 0,
  }

  await sendSessionRecapEmail(profile.email, profile.full_name, activities)
  return res.status(200).json({ sent: true, activities })
}
