import { createSubscription } from '@/lib/paypal'

const PLAN_MAP = {
  'starter-monthly': process.env.PAYPAL_PLAN_STARTER_MONTHLY,
  'starter-annual': process.env.PAYPAL_PLAN_STARTER_ANNUAL,
  'pro-monthly': process.env.PAYPAL_PLAN_PRO_MONTHLY,
  'pro-annual': process.env.PAYPAL_PLAN_PRO_ANNUAL,
  'business-monthly': process.env.PAYPAL_PLAN_BUSINESS_MONTHLY,
  'business-annual': process.env.PAYPAL_PLAN_BUSINESS_ANNUAL,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { plan_key, user_id, email } = req.body

  if (!plan_key || !PLAN_MAP[plan_key]) {
    return res.status(400).json({ error: 'Invalid plan_key' })
  }

  if (!user_id || !email) {
    return res.status(400).json({ error: 'user_id and email required' })
  }

  try {
    const subscription = await createSubscription(PLAN_MAP[plan_key], user_id, email)

    if (subscription.error) {
      return res.status(500).json({ error: subscription.error_description || 'PayPal error' })
    }

    // Find the approval URL
    const approveLink = subscription.links?.find((l) => l.rel === 'approve')
    if (!approveLink) {
      return res.status(500).json({ error: 'No approval URL from PayPal' })
    }

    return res.status(200).json({
      subscription_id: subscription.id,
      approve_url: approveLink.href,
    })
  } catch (err) {
    console.error('PayPal subscription error:', err)
    return res.status(500).json({ error: err.message })
  }
}
