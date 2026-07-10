import { createClient } from '@supabase/supabase-js'
import { generateText } from '../lib/ai'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(agentName: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: agentName, action, result, status, error: error || null }) } catch {}
}

export async function syncGumroadCustomers(): Promise<number> {
  try {
    const token = process.env.GUMROAD_ACCESS_TOKEN
    if (!token || token === 'placeholder') return 0
    const r = await fetch('https://api.gumroad.com/v2/sales', { headers: { Authorization: 'Bearer ' + token } })
    if (!r.ok) return 0
    const data = await r.json()
    const sales = data.sales
    if (!sales || !Array.isArray(sales) || sales.length === 0) return 0
    for (const sale of sales) {
      try {
        const email = sale.email || ''
        const name = sale.buyer_name || ''
        if (!email) continue
        const { data: existing } = await db.from('customers').select('id').eq('email', email).limit(1)
        let customerId: string | null = null
        if (existing && Array.isArray(existing) && existing.length > 0) {
          customerId = existing[0].id
          await db.from('customers').update({ name, gumroad_customer_id: sale.id }).eq('id', customerId)
        } else {
          const { data: newC } = await db.from('customers').insert({ email, name, gumroad_customer_id: sale.id }).select()
          if (newC && Array.isArray(newC) && newC.length > 0) customerId = newC[0].id
        }
        if (!customerId) continue
        const { data: existingTx } = await db.from('transactions').select('id').eq('gumroad_sale_id', sale.id).limit(1)
        if (!existingTx || !Array.isArray(existingTx) || existingTx.length === 0) {
          await db.from('transactions').insert({
            customer_id: customerId,
            amount_cents: Math.round(parseFloat(sale.price || '0') * 100),
            gumroad_sale_id: sale.id,
            status: 'completed'
          })
        }
      } catch {}
    }
    return sales.length
  } catch { return 0 }
}

export async function processCustomerInquiry(inquiry: {
  customerEmail: string
  customerName: string
  subject: string
  message: string
  orderId?: string
}): Promise<{ response: string; action: 'respond' | 'refund' | 'escalate' }> {
  await logAgent('customer_service', 'inquiry', inquiry.subject, 'success')
  try {
    const businessName = process.env.BUSINESS_NAME || 'our digital products business'
    const response = await generateText(
      'You are a helpful customer service rep for ' + businessName + '. Be warm and professional.\n\nCustomer: ' + inquiry.customerName + '\nEmail: ' + inquiry.customerEmail + '\nSubject: ' + inquiry.subject + '\nMessage: ' + inquiry.message + '\n\nWrite a helpful response.',
      512
    )
    const msg = inquiry.message.toLowerCase()
    let action: 'respond' | 'refund' | 'escalate' = 'respond'
    if (msg.includes('refund') || msg.includes('money back')) action = 'refund'
    else if (msg.includes('lawsuit') || msg.includes('fraud') || msg.includes('scam')) action = 'escalate'
    return { response, action }
  } catch {
    return { response: 'Thank you for reaching out. We will respond within 24 hours.', action: 'respond' }
  }
}
