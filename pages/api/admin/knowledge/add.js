import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { ingestDocument } from '@/lib/knowledge-engine'

const ADMIN_EMAILS = ['khurrambadar@gmail.com']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_email, title, content, domain, subdomain, vertical, source_type, tags, language, region, compliance_standards } = req.body

  // Admin check
  if (!user_email || !ADMIN_EMAILS.includes(user_email)) {
    return res.status(403).json({ error: 'Admin access only' })
  }

  if (!title || !content || !domain || !source_type) {
    return res.status(400).json({ error: 'title, content, domain, and source_type are required' })
  }

  try {
    const result = await ingestDocument({
      title,
      content,
      domain,
      subdomain,
      vertical,
      source_type,
      tags: tags || [],
      language: language || 'en',
      region: region || 'global',
      compliance_standards: compliance_standards || [],
    })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
