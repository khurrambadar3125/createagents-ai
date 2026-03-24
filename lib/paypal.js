const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_SECRET = process.env.PAYPAL_SECRET
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64')
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

export async function createSubscription(planId, userId, email) {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: planId,
      subscriber: {
        email_address: email,
      },
      custom_id: userId,
      application_context: {
        brand_name: 'CreateAgent.ai',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://createagents.ai'}/dashboard?upgraded=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://createagents.ai'}/pricing`,
      },
    }),
  })
  return res.json()
}

export async function cancelSubscription(subscriptionId, reason = 'Customer requested cancellation') {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  })
  return res.status === 204
}

export async function getSubscriptionDetails(subscriptionId) {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function verifyWebhookSignature(headers, body) {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: body,
    }),
  })
  const data = await res.json()
  return data.verification_status === 'SUCCESS'
}
