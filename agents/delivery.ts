import { createClient } from '@supabase/supabase-js'
import { generateText } from '../lib/ai'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(name: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: name, action, result, status, error: error || null }) } catch {}
}

async function sendViaSendgrid(to: string, subject: string, body: string): Promise<boolean> {
  const key = (process.env.SENDGRID_API_KEY || '').trim()
  if (!key || key === 'placeholder') return false
  try {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.FROM_EMAIL || 'hello@firenic.ai', name: process.env.BUSINESS_NAME || 'FireNice AI' },
        subject,
        content: [{ type: 'text/plain', value: body }]
      })
    })
    return r.ok || r.status === 202
  } catch { return false }
}

export async function ensureProductContent(product: any): Promise<string> {
  if (product.file_content && product.file_content.length > 200) {
    const text = product.file_content
    const isBase64Image = text.startsWith('data:image')
    if (!isBase64Image) return product.file_content
    const lines = text.split('\n')
    const contentLines = lines.filter((l: string) => !l.startsWith('data:') && l.length > 10)
    if (contentLines.length > 3) return contentLines.join('\n')
  }

  try {
    const typeDescriptions: Record<string, string> = {
      'prompt-pack': 'a comprehensive collection of AI prompts with examples, use cases, and tips. Include 20+ ready-to-use prompts organized by category.',
      'ebook': 'a complete ebook with introduction, 5+ chapters, practical examples, and conclusion.',
      'template': 'a professional template with instructions, customization guide, and multiple use case examples.',
      'guide': 'a step-by-step guide with clear instructions, tips, warnings, and actionable takeaways.',
      'crypto': 'a complete cryptocurrency launch package including whitepaper summary, tokenomics, and launch checklist.',
      'nft': 'NFT minting instructions, metadata description, and collection details.',
      'digital': 'a comprehensive digital resource with practical value and immediate usability.'
    }
    const typeDesc = typeDescriptions[product.type] || typeDescriptions['digital']

    const content = await generateText(
      'Generate COMPLETE content for this purchased digital product:\n' +
      'Product Name: ' + product.name + '\n' +
      'Type: ' + product.type + '\n' +
      'Description: ' + (product.description || '') + '\n\n' +
      'Create ' + typeDesc + '\n\n' +
      'Format it professionally with clear sections, headers, and actionable content. This is what the customer paid for — make it genuinely valuable.',
      4096
    )

    await db.from('products').update({ file_content: content }).eq('id', product.id)
    await logAgent('delivery', 'content_generated', product.name, 'success')
    return content
  } catch (e: any) {
    return 'Thank you for purchasing ' + product.name + '.\n\n' + (product.description || '') + '\n\nContent is being prepared. Please reply to this email and we will send it within 24 hours.'
  }
}

function formatProductEmail(product: any, content: string, amountPaid: string): string {
  const businessName = process.env.BUSINESS_NAME || 'FireNice AI'
  const workerUrl = process.env.WORKER_URL || 'https://worker-ai-beryl.vercel.app'

  const lines = [
    businessName.toUpperCase() + ' — YOUR PURCHASE IS READY',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'PRODUCT: ' + product.name,
    'AMOUNT PAID: ' + amountPaid,
    'TYPE: ' + product.type,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'YOUR PRODUCT CONTENT',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    content,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'You can also access your purchase anytime at:',
    workerUrl + '/success',
    '',
    'Questions? Reply to this email.',
    '',
    'Thank you,',
    businessName + ' Team'
  ]

  return lines.join('\n')
}

export async function deliverProduct(transaction: any): Promise<{ delivered: boolean; method: string; note: string }> {
  await logAgent('delivery', 'start', String(transaction.id), 'success')

  const { data: customers } = await db.from('customers').select('*').eq('id', transaction.customer_id).limit(1)
  const customer = customers && customers.length > 0 ? customers[0] : null

  if (!customer) {
    await logAgent('delivery', 'no_customer', String(transaction.id), 'error', 'Customer not found')
    return { delivered: false, method: 'failed', note: 'Customer not found' }
  }

  const email = customer.email || ''
  const isFakeEmail = email.includes('@sale.firenic') || email.includes('@square.sale') || email.includes('@paypal.sale')

  if (isFakeEmail || !email) {
    await db.from('transactions').update({ status: 'needs_email' }).eq('id', transaction.id)
    return { delivered: false, method: 'pending', note: 'No customer email. Buyer must visit /success to download.' }
  }

  let product: any = null
  if (transaction.product_id) {
    const { data: p } = await db.from('products').select('*').eq('id', transaction.product_id).limit(1)
    product = p && p.length > 0 ? p[0] : null
  }

  if (!product) {
    const { data: p } = await db.from('products').select('*').not('gumroad_url', 'is', null).order('created_at', { ascending: false }).limit(1)
    product = p && p.length > 0 ? p[0] : null
  }

  if (!product) {
    await logAgent('delivery', 'no_product', String(transaction.id), 'error')
    return { delivered: false, method: 'failed', note: 'No product found' }
  }

  const content = await ensureProductContent(product)
  const amountPaid = '$' + ((transaction.amount_cents || 0) / 100).toFixed(2)
  const subject = 'Your ' + product.name + ' — Download Inside'
  const body = formatProductEmail(product, content, amountPaid)

  const sent = await sendViaSendgrid(email, subject, body)

  if (sent) {
    await db.from('transactions').update({ status: 'delivered' }).eq('id', transaction.id)
    await logAgent('delivery', 'delivered_email', email, 'success')
    return { delivered: true, method: 'email', note: 'Delivered to ' + email }
  }

  await db.from('transactions').update({ status: 'delivery_pending_sendgrid' }).eq('id', transaction.id)
  await logAgent('delivery', 'sendgrid_not_configured', 'Buyer must use /success page', 'error')
  return { delivered: false, method: 'success_page_only', note: 'SendGrid not configured. Buyer can download at /success. Add SENDGRID_API_KEY to fix.' }
}

export async function deliverOne(transactionId: string): Promise<{ delivered: boolean; method: string; note: string }> {
  const { data: tx } = await db.from('transactions').select('*').eq('id', transactionId).limit(1)
  if (!tx || tx.length === 0) return { delivered: false, method: 'failed', note: 'Transaction not found' }
  return deliverProduct(tx[0])
}

export async function deliverPendingOrders(): Promise<number> {
  try {
    const { data: pending } = await db.from('transactions').select('*').in('status', ['completed', 'paid', 'needs_email']).limit(20)
    if (!pending || pending.length === 0) return 0
    let delivered = 0
    for (const tx of pending) {
      try { const result = await deliverProduct(tx); if (result.delivered) delivered++ } catch {}
    }
    return delivered
  } catch { return 0 }
}
