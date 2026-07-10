import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel environment variables.')
}

export const db = createClient(supabaseUrl, supabaseKey)

export async function logAgent(
  agentName: string,
  action: string,
  result: string,
  status: 'success' | 'error',
  error?: string
): Promise<void> {
  try {
    await db.from('agent_logs').insert({
      agent_name: agentName,
      action,
      result,
      status,
      error: error || null
    })
  } catch {}
}

export async function setState(key: string, value: string): Promise<void> {
  try {
    await db.from('system_state').upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    })
  } catch {}
}

export async function getState(key: string): Promise<string | null> {
  try {
    const { data } = await db
      .from('system_state')
      .select('value')
      .eq('key', key)
      .limit(1)
    return data && Array.isArray(data) && data.length > 0 ? data[0].value : null
  } catch { return null }
}

export async function getActiveProducts(): Promise<any[]> {
  try {
    const { data } = await db
      .from('products')
      .select('*')
      .not('gumroad_url', 'is', null)
      .order('created_at', { ascending: false })
    return data || []
  } catch { return [] }
}

export async function getTotalRevenueCents(): Promise<number> {
  try {
    const { data } = await db.from('transactions').select('amount_cents')
    if (!data || data.length === 0) return 0
    return data.reduce((sum, row) => sum + (row.amount_cents || 0), 0)
  } catch { return 0 }
}
