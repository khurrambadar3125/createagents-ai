import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

const ADMIN_EMAILS = ['khurrambadar@gmail.com']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_email, document_id } = req.body

  if (!user_email || !ADMIN_EMAILS.includes(user_email)) {
    return res.status(403).json({ error: 'Admin access only' })
  }

  const { error } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', document_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ deleted: true })
}
