import { createClient } from '@supabase/supabase-js'
import { cancelSubscription } from '@/lib/paypal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('paypal_subscription_id')
    .eq('id', user_id)
    .single()

  if (!profile?.paypal_subscription_id) {
    return res.status(400).json({ error: 'No active subscription found.' })
  }

  try {
    const success = await cancelSubscription(profile.paypal_subscription_id)
    if (success) {
      await supabase.from('profiles').update({
        plan: 'free',
        runs_limit: 15,
        paypal_subscription_id: null,
      }).eq('id', user_id)
      return res.status(200).json({ cancelled: true })
    }
    return res.status(500).json({ error: 'Failed to cancel subscription' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
