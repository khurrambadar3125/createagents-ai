import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PRICE_MAP = {
  'starter-monthly': process.env.STRIPE_PRICE_STARTER_MONTHLY,
  'starter-annual': process.env.STRIPE_PRICE_STARTER_ANNUAL,
  'pro-monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
  'pro-annual': process.env.STRIPE_PRICE_PRO_ANNUAL,
  'business-monthly': process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  'business-annual': process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { price_key, user_id, email } = req.body

  if (!price_key || !PRICE_MAP[price_key]) {
    return res.status(400).json({ error: 'Invalid price_key' })
  }

  if (!user_id || !email) {
    return res.status(400).json({ error: 'user_id and email required' })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: PRICE_MAP[price_key], quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://createagents.ai'}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://createagents.ai'}/pricing`,
      metadata: { user_id, plan: price_key.split('-')[0] },
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return res.status(500).json({ error: err.message })
  }
}
