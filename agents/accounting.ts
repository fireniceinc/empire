import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(name: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: name, action, result, status, error: error || null }) } catch {}
}

async function getPaypalBalance(): Promise<string> {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim()
  const secret = (process.env.PAYPAL_CLIENT_SECRET || '').trim()
  if (!clientId || clientId === 'placeholder' || clientId.length < 10) return 'Not configured'
  if (!secret || secret === 'placeholder' || secret.length < 10) return 'Secret missing'
  try {
    const sandbox = process.env.PAYPAL_SANDBOX !== 'false'
    const base = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
    const credentials = clientId + ':' + secret
    const encoded = Buffer.from(credentials).toString('base64')
    const tokenRes = await fetch(base + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + encoded,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: 'grant_type=client_credentials'
    })
    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      await logAgent('accounting', 'paypal_auth_failed', errText.slice(0, 100), 'error')
      return sandbox ? 'Sandbox auth failed — check sandbox credentials' : 'Live auth failed — check live credentials'
    }
    const tokenData = await tokenRes.json()
    const token = tokenData.access_token
    if (!token) return 'No token received'
    const balRes = await fetch(base + '/v1/reporting/balances', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (!balRes.ok) return sandbox ? 'Sandbox: balance unavailable' : 'Balance unavailable'
    const balData = await balRes.json()
    const bal = balData.available_balance
    if (!bal) return '$0.00'
    return '$' + parseFloat(bal.value || '0').toFixed(2) + ' ' + (bal.currency_code || 'USD') + (sandbox ? ' (sandbox)' : '')
  } catch (e: any) {
    return 'Error: ' + e.message.slice(0, 50)
  }
}

async function getSquareBalance(): Promise<string> {
  const token = (process.env.SQUARE_ACCESS_TOKEN || '').trim()
  if (!token || token === 'placeholder') return 'Not configured'
  try {
    const locationId = process.env.SQUARE_LOCATION_ID || ''
    const r = await fetch('https://connect.squareup.com/v2/locations/' + locationId, {
      headers: { 'Authorization': 'Bearer ' + token, 'Square-Version': '2024-01-17' }
    })
    if (!r.ok) return 'Square auth failed'
    return 'Square connected'
  } catch { return 'Square unavailable' }
}

export async function updateRevenueTotals(): Promise<void> {
  try {
    const { data: transactions } = await db.from('transactions').select('product_id, amount_cents')
    if (!transactions || transactions.length === 0) return
    const productTotals: Record<string, { revenue: number; count: number }> = {}
    let totalRevenue = 0
    for (const tx of transactions) {
      totalRevenue += tx.amount_cents || 0
      if (tx.product_id) {
        if (!productTotals[tx.product_id]) productTotals[tx.product_id] = { revenue: 0, count: 0 }
        productTotals[tx.product_id].revenue += tx.amount_cents || 0
        productTotals[tx.product_id].count += 1
      }
    }
    for (const [productId, totals] of Object.entries(productTotals)) {
      await db.from('products').update({ revenue_cents: totals.revenue, sales_count: totals.count }).eq('id', productId)
    }
    await db.from('system_state').upsert({ key: 'total_revenue_cents', value: String(totalRevenue), updated_at: new Date().toISOString() })
  } catch (e: any) {
    await logAgent('accounting', 'update_failed', e.message, 'error', e.message)
  }
}

export async function generateReport(): Promise<{
  totalRevenueCents: number
  totalTransactions: number
  topProduct: string
  paypalBalance: string
  gumroadBalance: string
  report: string
}> {
  await logAgent('accounting', 'report', 'Generating', 'success')
  try {
    const { data: transactions } = await db.from('transactions').select('amount_cents, product_id, created_at, status')
    const totalTransactions = transactions ? transactions.length : 0
    const totalRevenueCents = transactions ? transactions.reduce((s, t) => s + (t.amount_cents || 0), 0) : 0
    const { data: products } = await db.from('products').select('id, name, revenue_cents, sales_count, type, gumroad_url').order('revenue_cents', { ascending: false }).limit(5)
    const topProduct = products && products.length > 0 ? products[0].name : 'No products yet'
    const { data: active } = await db.from('products').select('id').not('gumroad_url', 'is', null)
    const activeCount = active ? active.length : 0
    const { data: recent } = await db.from('agent_logs').select('id, status').gte('created_at', new Date(Date.now() - 86400000).toISOString())
    const logCount = recent ? recent.length : 0
    const errorCount = recent ? recent.filter(l => l.status === 'error').length : 0
    const { data: customers } = await db.from('customers').select('id')
    const customerCount = customers ? customers.length : 0
    const paypalBalance = await getPaypalBalance()
    const squareBalance = await getSquareBalance()
    const totalRevenueDollars = '$' + (totalRevenueCents / 100).toFixed(2)

    const lines = [
      '═══════════════════════════════════',
      '  FIRENIC AI — P&L REPORT',
      '  ' + new Date().toLocaleString(),
      '═══════════════════════════════════',
      '',
      'REVENUE',
      '  Total:           ' + totalRevenueDollars,
      '  Transactions:    ' + totalTransactions,
      '  Customers:       ' + customerCount,
      '',
      'PRODUCTS',
      '  Active listings: ' + activeCount,
      '  Top seller:      ' + topProduct,
    ]
    if (products && products.length > 0) {
      lines.push('')
      lines.push('TOP PRODUCTS')
      products.slice(0, 3).forEach((p: any) => {
        lines.push('  ' + p.name.slice(0, 30) + ' — ' + (p.sales_count || 0) + ' sales — $' + ((p.revenue_cents || 0) / 100).toFixed(2))
      })
    }
    lines.push('')
    lines.push('PLATFORM BALANCES')
    lines.push('  PayPal:    ' + paypalBalance)
    lines.push('  Square:    ' + squareBalance)
    lines.push('')
    lines.push('SYSTEM HEALTH (24h)')
    lines.push('  Agent actions: ' + logCount)
    lines.push('  Errors:        ' + errorCount)
    lines.push('═══════════════════════════════════')

    await logAgent('accounting', 'report_complete', totalRevenueDollars, 'success')
    return { totalRevenueCents, totalTransactions, topProduct, paypalBalance, gumroadBalance: squareBalance, report: lines.join('\n') }
  } catch (e: any) {
    await logAgent('accounting', 'report_failed', e.message, 'error', e.message)
    return { totalRevenueCents: 0, totalTransactions: 0, topProduct: 'Error', paypalBalance: 'Error', gumroadBalance: 'Error', report: 'Report failed: ' + e.message }
  }
}
