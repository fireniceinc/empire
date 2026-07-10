import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | { timedOut: true }> {
  return Promise.race([promise, new Promise<{ timedOut: true }>((resolve) => setTimeout(() => resolve({ timedOut: true }), ms))])
}

const LIGHT_PRODUCT_COLUMNS = 'id, name, description, type, price_cents, gumroad_url, sales_count, revenue_cents, art_status, created_at'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json')

  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || url === 'placeholder' || !key || key === 'placeholder') {
    return res.json({ state: {}, products: [], agentLogs: [], connectivity_error: 'SUPABASE_URL or SUPABASE_SERVICE_KEY not configured' })
  }

  try {
    const [stateRes, productsRes, logsRes, txRes] = await Promise.all([
      withTimeout(Promise.resolve(db.from('system_state').select('*')), 8000),
      withTimeout(Promise.resolve(db.from('products').select(LIGHT_PRODUCT_COLUMNS).order('created_at', { ascending: false }).limit(100)), 8000),
      withTimeout(Promise.resolve(db.from('agent_logs').select('agent_name, action, status, created_at').order('created_at', { ascending: false }).limit(10)), 8000),
      withTimeout(Promise.resolve(db.from('transactions').select('amount_cents')), 8000)
    ])

    const anyTimedOut = [stateRes, productsRes, logsRes, txRes].some((r: any) => r && r.timedOut)
    if (anyTimedOut) {
      return res.json({
        state: {}, products: [], agentLogs: [], productCount: 0, totalRevenue: 0,
        connectivity_error: 'Query timed out. Check /api/db-ping for the exact cause.'
      })
    }

    const stateRows = (stateRes as any)?.data || []
    const productsData = (productsRes as any)?.data || []
    const logsData = (logsRes as any)?.data || []
    const txData = (txRes as any)?.data || []
    const stateObj: Record<string, string> = {}
    stateRows.forEach((row: any) => { stateObj[row.key] = row.value })
    const totalRevenue = txData.reduce((s: number, t: any) => s + (t.amount_cents || 0), 0)
    stateObj.total_revenue_cents = String(totalRevenue)

    return res.json({ state: stateObj, products: productsData, agentLogs: logsData, totalRevenue, connectivity_error: null })
  } catch (e: any) {
    return res.json({ state: {}, products: [], agentLogs: [], connectivity_error: 'Query failed: ' + e.message })
  }
}
