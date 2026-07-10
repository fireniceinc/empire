import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(name: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: name, action, result, status, error: error || null }) } catch {}
}

async function upsertCustomer(email: string, name: string): Promise<string | null> {
  try {
    const { data: ex } = await db.from('customers').select('id').eq('email', email).limit(1)
    if (ex && ex.length > 0) return ex[0].id
    const { data: nc } = await db.from('customers').insert({ email, name }).select()
    return nc && nc.length > 0 ? nc[0].id : null
  } catch { return null }
}

async function getMostRecentListedProduct(): Promise<string | null> {
  try {
    const { data } = await db.from('products').select('id').not('gumroad_url', 'is', null).order('created_at', { ascending: false }).limit(1)
    return data && data.length > 0 ? data[0].id : null
  } catch { return null }
}

async function recordSale(customerId: string, amountCents: number, externalId: string, source: string): Promise<string | null> {
  try {
    const { data: ex } = await db.from('transactions').select('id').eq('gumroad_sale_id', externalId).limit(1)
    if (ex && ex.length > 0) {
      await logAgent('webhook', source + '_duplicate', externalId, 'success')
      return ex[0].id
    }
    const productId = await getMostRecentListedProduct()
    const { data: tx } = await db.from('transactions').insert({
      customer_id: customerId,
      product_id: productId,
      amount_cents: amountCents,
      currency: 'usd',
      gumroad_sale_id: externalId,
      status: 'completed'
    }).select()
    if (!tx || tx.length === 0) return null
    const txId = tx[0].id
    const { data: stateRow } = await db.from('system_state').select('value').eq('key', 'total_revenue_cents').limit(1)
    const current = stateRow && stateRow.length > 0 ? parseInt(stateRow[0].value || '0') : 0
    await db.from('system_state').upsert({ key: 'total_revenue_cents', value: String(current + amountCents), updated_at: new Date().toISOString() })
    if (productId) {
      const { data: prod } = await db.from('products').select('sales_count, revenue_cents').eq('id', productId).limit(1)
      if (prod && prod.length > 0) {
        await db.from('products').update({
          sales_count: (prod[0].sales_count || 0) + 1,
          revenue_cents: (prod[0].revenue_cents || 0) + amountCents
        }).eq('id', productId)
      }
    }
    await logAgent('webhook', source + '_sale_recorded', '$' + (amountCents / 100).toFixed(2), 'success')
    return txId
  } catch (e: any) {
    await logAgent('webhook', source + '_record_error', e.message, 'error', e.message)
    return null
  }
}

async function triggerDelivery(transactionId: string): Promise<void> {
  try {
    const workerUrl = process.env.WORKER_URL || 'https://worker-ai-beryl.vercel.app'
    fetch(workerUrl + '/api/orchestrate?action=deliver-one&txId=' + transactionId).catch(() => {})
  } catch {}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Webhook endpoint active', timestamp: new Date().toISOString() })
  }
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  res.status(200).json({ received: true })

  try {
    const body = req.body || {}
    const headers = req.headers
    const queryType = String(req.query.type || '')

    await logAgent('webhook', 'received', queryType || 'unknown', 'success')

    const isSquare = queryType === 'square' || !!headers['square-signature'] || (body.merchant_id && body.type)
    const isPaypal = queryType === 'paypal' || !!headers['paypal-transmission-id'] || !!headers['x-paypal-transmission-id']
    const isGumroad = queryType === 'gumroad' || !!headers['x-gumroad-signature']
    const isLemon = queryType === 'lemonsqueezy' || queryType === 'lemon'

    if (isSquare) {
      const eventType = String(body.type || '')
      await logAgent('webhook', 'square_event', eventType, 'success')

      const payment = body.data?.object?.payment
      if (!payment) return

      const squareStatus = String(payment.status || '').toUpperCase()
      if (squareStatus === 'COMPLETED' || squareStatus === 'APPROVED' || eventType === 'payment.created' || eventType === 'payment.updated') {
        if (squareStatus !== 'COMPLETED' && squareStatus !== 'APPROVED' && eventType !== 'payment.created') return

        const amountCents = payment.amount_money?.amount || payment.total_money?.amount || 0
        const paymentId = payment.id || ('sq-' + Date.now())
        const buyerEmail = payment.buyer_email_address || payment.receipt_url?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || ''
        const buyerName = payment.shipping_address?.recipient_name || payment.billing_address?.recipient_name || 'Square Customer'
        const receiptUrl = payment.receipt_url || ''

        await logAgent('webhook', 'square_payment_' + squareStatus.toLowerCase(), '$' + (amountCents / 100).toFixed(2) + ' id:' + paymentId, 'success')

        const emailToUse = buyerEmail || ('square-' + paymentId + '@sale.firenic')
        const customerId = await upsertCustomer(emailToUse, buyerName)
        if (customerId) {
          const txId = await recordSale(customerId, amountCents, paymentId, 'square')
          if (txId) {
            if (buyerEmail) {
              await triggerDelivery(txId)
            } else {
              await logAgent('webhook', 'square_no_email', 'Sale recorded receipt:' + receiptUrl, 'success')
            }
          }
        }
      }
      return
    }

    if (isPaypal) {
      const eventType = String(body.event_type || body.event || '')
      await logAgent('webhook', 'paypal_event', eventType, 'success')

      const isPayment = eventType === 'PAYMENT.SALE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.COMPLETED'
      if (!isPayment) return

      const resource = body.resource || {}
      const amount = resource.amount?.total || resource.amount?.value || resource.gross_amount?.value || resource.seller_receivable_breakdown?.gross_amount?.value || '0'
      const amountCents = Math.round(parseFloat(String(amount)) * 100)
      const paymentId = resource.id || resource.sale_id || ('pp-' + Date.now())
      const payerEmail = resource.payer?.email_address || resource.payer?.payer_info?.email || ''
      const payerName = resource.payer?.name?.given_name || resource.payer?.payer_info?.first_name || 'PayPal Customer'

      if (amountCents > 0) {
        const emailToUse = payerEmail || ('paypal-' + paymentId + '@sale.firenic')
        const customerId = await upsertCustomer(emailToUse, payerName)
        if (customerId) {
          const txId = await recordSale(customerId, amountCents, paymentId, 'paypal')
          if (txId && payerEmail) await triggerDelivery(txId)
        }
      }
      return
    }

    if (isGumroad) {
      const saleId = String(body.sale_id || body.id || ('gum-' + Date.now()))
      const email = String(body.email || '')
      const buyerName = String(body.buyer_name || 'Gumroad Customer')
      const amountCents = Math.round(parseFloat(String(body.price || '0')) * 100)
      await logAgent('webhook', 'gumroad_sale', saleId, 'success')
      if (email) {
        const customerId = await upsertCustomer(email, buyerName)
        if (customerId) {
          const txId = await recordSale(customerId, amountCents, saleId, 'gumroad')
          if (txId) await triggerDelivery(txId)
        }
      }
      return
    }

    if (isLemon) {
      const eventName = String(body.meta?.event_name || '')
      await logAgent('webhook', 'lemon_event', eventName, 'success')
      if (eventName === 'order_created') {
        const orderData = body.data?.attributes || {}
        const amountCents = orderData.total || 0
        const email = orderData.user_email || ''
        const name = orderData.user_name || 'LemonSqueezy Customer'
        const orderId = String(body.data?.id || ('ls-' + Date.now()))
        if (email) {
          const customerId = await upsertCustomer(email, name)
          if (customerId) {
            const txId = await recordSale(customerId, amountCents, orderId, 'lemonsqueezy')
            if (txId) await triggerDelivery(txId)
          }
        }
      }
      return
    }

    await logAgent('webhook', 'unhandled', JSON.stringify(body).slice(0, 100), 'success')
  } catch (e: any) {
    await logAgent('webhook', 'error', e.message, 'error', e.message)
  }
}
