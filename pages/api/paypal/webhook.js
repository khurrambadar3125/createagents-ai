import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { verifyWebhookSignature } from '@/lib/paypal'

const PLAN_RUNS = { starter: 400, pro: 900, business: -1 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const event = req.body

  // Verify webhook signature in production
  if (process.env.PAYPAL_WEBHOOK_ID) {
    const verified = await verifyWebhookSignature(req.headers, event).catch(() => false)
    if (!verified) {
      console.error('PayPal webhook signature verification failed')
      return res.status(400).json({ error: 'Invalid signature' })
    }
  }

  const eventType = event.event_type
  const resource = event.resource

  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED': {
      const userId = resource.custom_id
      const subscriptionId = resource.id
      // Determine plan from the plan_id
      const planId = resource.plan_id
      const plan = getPlanFromPayPalId(planId)

      if (userId && plan) {
        const runsLimit = PLAN_RUNS[plan] || 15
        await supabase.from('profiles').update({
          plan,
          runs_limit: runsLimit,
          paypal_subscription_id: subscriptionId,
        }).eq('id', userId)
        console.log(`Upgraded user ${userId} to ${plan}`)
      }
      break
    }

    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      const subscriptionId = resource.id
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('paypal_subscription_id', subscriptionId)

      if (profiles?.[0]) {
        await supabase.from('profiles').update({
          plan: 'free',
          runs_limit: 15,
        }).eq('id', profiles[0].id)
        console.log(`Downgraded user ${profiles[0].id} to free`)
      }
      break
    }

    case 'PAYMENT.SALE.COMPLETED': {
      // Recurring payment received — could log or extend
      console.log('Payment received:', resource.id)
      break
    }
  }

  return res.status(200).json({ received: true })
}

function getPlanFromPayPalId(planId) {
  const map = {
    [process.env.PAYPAL_PLAN_STARTER_MONTHLY]: 'starter',
    [process.env.PAYPAL_PLAN_STARTER_ANNUAL]: 'starter',
    [process.env.PAYPAL_PLAN_PRO_MONTHLY]: 'pro',
    [process.env.PAYPAL_PLAN_PRO_ANNUAL]: 'pro',
    [process.env.PAYPAL_PLAN_BUSINESS_MONTHLY]: 'business',
    [process.env.PAYPAL_PLAN_BUSINESS_ANNUAL]: 'business',
  }
  return map[planId] || null
}
