import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

/**
 * Learning loop — tracks every user action for the platform to learn from.
 * Called automatically from the frontend on key actions.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, event, metadata } = req.body
  if (!event) return res.status(400).json({ error: 'event is required' })

  // Store the event (table created via Supabase dashboard or auto-created)
  await supabase.from('learning_events').insert({
    user_id: user_id || null,
    event,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  }).catch(() => {
    // Table might not exist yet — that's ok, events are fire-and-forget
  })

  return res.status(200).json({ tracked: true })
}
