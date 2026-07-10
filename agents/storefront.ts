import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(name: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: name, action, result, status, error: error || null }) } catch {}
}

const WORKER_URL = process.env.WORKER_URL || 'https://worker-ai-beryl.vercel.app'

async function squareRequest(path: string, method: string, body?: any): Promise<any> {
  const token = (process.env.SQUARE_ACCESS_TOKEN || '').trim()
  if (!token || token === 'placeholder') throw new Error('SQUARE_ACCESS_TOKEN not configured')
  const r = await fetch('https://connect.squareup.com/v2' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Square-Version': '2024-01-17'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const d = await r.json()
  if (d.errors && d.errors.length > 0) throw new Error(d.errors[0].detail || d.errors[0].category)
  return d
}

async function createSquareCatalogItem(name: string, description: string, priceCents: number): Promise<string | null> {
  try {
    const idempotencyKey = 'cat-' + Date.now()
    const variationId = '#variation-' + Date.now()
    const itemId = '#item-' + Date.now()
    const locationId = process.env.SQUARE_LOCATION_ID || ''
    const d = await squareRequest('/catalog/batch-upsert', 'POST', {
      idempotency_key: idempotencyKey,
      batches: [{
        objects: [{
          type: 'ITEM',
          id: itemId,
          item_data: {
            name: name.slice(0, 512),
            description: description.slice(0, 4096),
            product_type: 'DIGITAL',
            variations: [{
              type: 'ITEM_VARIATION',
              id: variationId,
              item_variation_data: {
                item_id: itemId,
                name: 'Digital Download',
                pricing_type: 'FIXED_PRICING',
                price_money: { amount: priceCents, currency: 'USD' }
              }
            }]
          }
        }]
      }]
    })
    const catalogId = d.objects?.[0]?.id || d.objects?.[1]?.id
    await logAgent('storefront', 'square_catalog_created', String(catalogId), 'success')
    return catalogId
  } catch (e: any) {
    await logAgent('storefront', 'square_catalog_failed', e.message, 'error', e.message)
    return null
  }
}

async function createSquarePaymentLink(name: string, priceCents: number, productId: string, description: string): Promise<{ id: string; url: string } | null> {
  try {
    const locationId = process.env.SQUARE_LOCATION_ID || ''
    const previewUrl = WORKER_URL + '/product/' + productId
    const noteText = description.slice(0, 200) + ' | Full preview with details: ' + previewUrl
    const d = await squareRequest('/online-checkout/payment-links', 'POST', {
      idempotency_key: 'link-' + Date.now(),
      quick_pay: {
        name: name.slice(0, 255),
        price_money: { amount: priceCents, currency: 'USD' },
        location_id: locationId
      },
      checkout_options: {
        redirect_url: WORKER_URL + '/success',
        ask_for_shipping_address: false
      },
      pre_populated_data: {},
      description: noteText.slice(0, 4096)
    })
    const link = d.payment_link
    if (!link) return null
    const url = link.url || link.long_url || ''
    return { id: link.id || ('sq-' + Date.now()), url }
  } catch (e: any) {
    return null
  }
}

async function tryPayPal(name: string, description: string, priceCents: number): Promise<{ id: string; url: string } | null> {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim()
  const secret = (process.env.PAYPAL_CLIENT_SECRET || '').trim()
  if (!clientId || clientId === 'placeholder') return null
  try {
    const sandbox = process.env.PAYPAL_SANDBOX !== 'false'
    const base = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
    const auth = Buffer.from(clientId + ':' + secret).toString('base64')
    const tokenRes = await fetch(base + '/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials'
    })
    if (!tokenRes.ok) {
      await logAgent('storefront', 'paypal_auth_failed', String(tokenRes.status), 'error')
      return null
    }
    const tokenData = await tokenRes.json()
    const token = tokenData.access_token
    if (!token) return null
    const r = await fetch(base + '/v2/checkout/orders', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: (priceCents / 100).toFixed(2) },
          description: description.slice(0, 127)
        }],
        application_context: {
          brand_name: process.env.BUSINESS_NAME || 'FireNice',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: WORKER_URL + '/success',
          cancel_url: WORKER_URL + '/store'
        }
      })
    })
    if (!r.ok) return null
    const d = await r.json()
    if (!d.id) return null
    const approveLink = d.links?.find((l: any) => l.rel === 'approve')?.href || ''
    if (!approveLink) return null
    await logAgent('storefront', 'paypal_order_created', d.id, 'success')
    return { id: d.id, url: approveLink }
  } catch (e: any) {
    await logAgent('storefront', 'paypal_failed', e.message, 'error', e.message)
    return null
  }
}

async function tryLemonSqueezy(name: string, description: string, priceCents: number): Promise<{ id: string; url: string } | null> {
  const key = (process.env.LEMON_SQUEEZY_API_KEY || '').trim()
  if (!key || key === 'placeholder') return null
  try {
    const headers = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json' }
    const storeRes = await fetch('https://api.lemonsqueezy.com/v1/stores', { headers })
    if (!storeRes.ok) return null
    const storeData = await storeRes.json()
    const storeId = storeData.data?.[0]?.id
    if (!storeId) return null
    const prodRes = await fetch('https://api.lemonsqueezy.com/v1/products', {
      method: 'POST', headers,
      body: JSON.stringify({ data: { type: 'products', attributes: { name, description }, relationships: { store: { data: { type: 'stores', id: String(storeId) } } } } })
    })
    if (!prodRes.ok) return null
    const prodData = await prodRes.json()
    const productId = prodData.data?.id
    if (!productId) return null
    await fetch('https://api.lemonsqueezy.com/v1/variants', {
      method: 'POST', headers,
      body: JSON.stringify({ data: { type: 'variants', attributes: { name: 'Default', price: priceCents }, relationships: { product: { data: { type: 'products', id: String(productId) } } } } })
    })
    const url = 'https://app.lemonsqueezy.com/products/' + productId
    await logAgent('storefront', 'lemon_listed', url, 'success')
    return { id: String(productId), url }
  } catch (e: any) {
    await logAgent('storefront', 'lemon_failed', e.message, 'error', e.message)
    return null
  }
}

export async function listProduct(product: {
  id: string
  name: string
  content: string
  description: string
  priceCents: number
  type: string
}): Promise<{ gumroadId: string; url: string; platform: string }> {
  await logAgent('storefront', 'listing_start', product.name, 'success')

  let result: { id: string; url: string } | null = null
  let platform = ''

  result = await createSquarePaymentLink(product.name, product.priceCents, product.id, product.description)
  if (result) {
    platform = 'square'
    await createSquareCatalogItem(product.name, product.description, product.priceCents)
  }

  if (!result) {
    result = await tryPayPal(product.name, product.description, product.priceCents)
    if (result) platform = 'paypal'
  }

  if (!result) {
    result = await tryLemonSqueezy(product.name, product.description, product.priceCents)
    if (result) platform = 'lemonsqueezy'
  }

  if (!result) {
    throw new Error('All storefronts failed. Check SQUARE_ACCESS_TOKEN, PAYPAL_CLIENT_ID, LEMON_SQUEEZY_API_KEY in Vercel env vars.')
  }

  await db.from('products').update({ gumroad_id: result.id, gumroad_url: result.url }).eq('id', product.id)
  const { data: stateData } = await db.from('system_state').select('value').eq('key', 'active_products').limit(1)
  const current = stateData && stateData.length > 0 ? parseInt(stateData[0].value || '0') : 0
  await db.from('system_state').upsert({ key: 'active_products', value: String(current + 1), updated_at: new Date().toISOString() })
  await logAgent('storefront', 'listed_' + platform, result.url, 'success')

  return { gumroadId: result.id, url: result.url, platform }
}
