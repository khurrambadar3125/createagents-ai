import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const config = { api: { bodyParser: false } }

const PLAN_RUNS = { starter: 400, pro: 900, business: -1 }

async function buffer(readable) {
  const chunks = []
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const buf = await buffer(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.user_id
      const plan = session.metadata?.plan
      if (userId && plan) {
        const runsLimit = PLAN_RUNS[plan] || 15
        await supabase.from('profiles').update({
          plan,
          runs_limit: runsLimit,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = subscription.customer
      // Find user by stripe customer id and downgrade
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
      if (profiles?.[0]) {
        await supabase.from('profiles').update({
          plan: 'free',
          runs_limit: 15,
        }).eq('id', profiles[0].id)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      console.warn('Payment failed for customer:', invoice.customer)
      break
    }
  }

  return res.status(200).json({ received: true })
}
