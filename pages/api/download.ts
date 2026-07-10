import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json')

  const email = String(req.query.email || req.body?.email || '').toLowerCase().trim()
  const txId = String(req.query.txId || req.body?.txId || '')

  if (!email && !txId) {
    return res.json({ error: 'Please enter your payment email address.' })
  }

  try {
    let transaction: any = null

    if (txId) {
      try {
        const { data } = await db.from('transactions').select('*').eq('id', txId).limit(1)
        transaction = data && data.length > 0 ? data[0] : null
      } catch {}
    }

    if (!transaction && email) {
      try {
        const { data: customers } = await db.from('customers').select('id').eq('email', email).limit(1)
        if (!customers || customers.length === 0) {
          return res.json({ error: 'No purchase found for this email. Please check the email you used to pay.' })
        }
        const customerId = customers[0].id
        const { data: transactions } = await db
          .from('transactions')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(1)
        transaction = transactions && transactions.length > 0 ? transactions[0] : null
      } catch {}
    }

    if (!transaction) {
      return res.json({ error: 'No purchase found. Check the email you used to pay. Square sales may take a few minutes.' })
    }

    let product: any = null

    if (transaction.product_id) {
      try {
        const { data } = await db.from('products').select('*').eq('id', transaction.product_id).limit(1)
        product = data && data.length > 0 ? data[0] : null
      } catch {}
    }

    if (!product) {
      try {
        const { data } = await db
          .from('products')
          .select('*')
          .not('gumroad_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
        product = data && data.length > 0 ? data[0] : null
      } catch {}
    }

    if (!product) {
      return res.json({ error: 'Product not found. Please contact support.' })
    }

    if (!product.file_content || product.file_content.length < 50) {
      try {
        const { generateText } = await import('../../lib/ai')
        const content = await generateText(
          'Generate the complete content for this purchased digital product:\nName: ' + product.name + '\nType: ' + product.type + '\nDescription: ' + (product.description || '') + '\n\nWrite full immediately usable content. Make it genuinely valuable.',
          4096
        )
        await db.from('products').update({ file_content: content }).eq('id', product.id)
        product.file_content = content
      } catch {}
    }

    try {
      await db.from('transactions').update({ status: 'delivered' }).eq('id', transaction.id)
    } catch {}

    const imageUrl = product.type === 'nft' && product.file_content
      ? product.file_content.split('\n').find((line: string) => line.startsWith('http'))
      : null

    try {
      await db.from('agent_logs').insert({
        agent_name: 'delivery',
        action: 'download_served',
        result: email || txId,
        status: 'success'
      })
    } catch {}

    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'placeholder') {
      try {
        const { deliverProduct } = await import('../../agents/delivery')
        deliverProduct(transaction).catch(() => {})
      } catch {}
    }

    return res.json({
      name: product.name,
      description: product.description,
      type: product.type,
      content: product.file_content,
      image_url: imageUrl || null,
      amount_paid: '$' + ((transaction.amount_cents || 0) / 100).toFixed(2),
      purchased_at: transaction.created_at
    })

  } catch (e: any) {
    return res.json({ error: 'Server error: ' + e.message })
  }
}
