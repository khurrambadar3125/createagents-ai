import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, email, full_name } = req.body
  if (!user_id || !email) return res.status(400).json({ error: 'user_id and email required' })

  // Check if already welcomed
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, welcomed')
    .eq('id', user_id)
    .single()

  if (profile?.welcomed) return res.status(200).json({ already_welcomed: true })

  // Send welcome email
  await sendWelcomeEmail(email, full_name)

  // Mark as welcomed
  await supabase
    .from('profiles')
    .update({ welcomed: true })
    .eq('id', user_id)

  return res.status(200).json({ sent: true })
}
