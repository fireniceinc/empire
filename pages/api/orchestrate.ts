import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { runResearch } from '../../agents/research'
import { createProduct } from '../../agents/product'
import { listProduct } from '../../agents/storefront'
import { runMarketing } from '../../agents/marketing'
import { syncGumroadCustomers } from '../../agents/customerService'
import { generateReport, updateRevenueTotals } from '../../agents/accounting'
import { createNFT } from '../../agents/nft'
import { runSelfUpdate } from '../../agents/selfUpdate'
import { deliverPendingOrders, deliverOne } from '../../agents/delivery'
import { analyzeBusinessCycle, selfImprove, findBestProductIdeas } from '../../agents/analytics'
import { listOnAllMarketplaces, generateSEOContent, submitToDirectories } from '../../agents/marketplace'
import { createCryptoCampaign } from '../../agents/crypto'
import { startLearningPath, runNextCycle, stopLearningPath, getLearningStatus } from '../../agents/learningPath'
import { checkAuth, grantAuth, revokeAuth, generateAuthReport, initDefaultAuthorizations, AuthResource, AuthLevel } from '../../agents/authAgent'
import { runPipelineDiagnostic } from '../../agents/diagnostics'
import { regenerateAllImages } from '../../agents/imageRegen'
import { claudeReviewProduct } from '../../agents/qualityReview'
import { checkSpendGate, setDailyCap, getApprovalQueue, resolveApproval, getSpendReport } from '../../agents/autonomyGate'
import { generateText } from '../../lib/ai'
import { getIdentity, saveIdentity, buildSignupKit } from '../../agents/identityKit'
const db = createClient(process.env.SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_KEY || 'placeholder')

async function setState(key: string, value: string): Promise<void> {
  try { await db.from('system_state').upsert({ key, value, updated_at: new Date().toISOString() }) } catch {}
}
async function getState(key: string): Promise<string | null> {
  try { const { data } = await db.from('system_state').select('value').eq('key', key).limit(1); return data && data.length > 0 ? data[0].value : null } catch { return null }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json')
  const action = String(req.query.action || (req.body && req.body.action) || 'status')

  try {
    await setState('business_cycle', action)

    if (action === 'status') {
      const [stateRes, productsRes, logsRes, txRes] = await Promise.allSettled([
        db.from('system_state').select('*'),
        db.from('products').select('*').order('created_at', { ascending: false }),
        db.from('agent_logs').select('*').order('created_at', { ascending: false }).limit(10),
        db.from('transactions').select('amount_cents')
      ])
      const stateRows = stateRes.status === 'fulfilled' ? (stateRes.value.data || []) : []
      const productsData = productsRes.status === 'fulfilled' ? (productsRes.value.data || []) : []
      const logsData = logsRes.status === 'fulfilled' ? (logsRes.value.data || []) : []
      const txData = txRes.status === 'fulfilled' ? (txRes.value.data || []) : []
      const stateObj: Record<string, string> = {}
      stateRows.forEach((row: any) => { stateObj[row.key] = row.value })
      const totalRevenue = txData.reduce((s: number, t: any) => s + (t.amount_cents || 0), 0)
      stateObj.total_revenue_cents = String(totalRevenue)
      await setState('business_cycle', 'idle')
      return res.json({ state: stateObj, products: productsData, agentLogs: logsData, totalRevenue })
    }

    if (action === 'set-level') {
      const level = String(req.query.level || req.body?.level || '1')
      if (!['1', '2', '3', '4'].includes(level)) { await setState('business_cycle', 'idle'); return res.json({ error: 'Level must be 1-4' }) }
      await setState('autonomy_level', level)
      await setState('business_cycle', 'idle')
      return res.json({ success: true, autonomy_level: level })
    }

    if (action === 'set-daily-cap') {
      const dollars = parseFloat(String(req.query.dollars || req.body?.dollars || '10'))
      await setDailyCap(Math.round(dollars * 100))
      await setState('business_cycle', 'idle')
      return res.json({ success: true, capDollars: dollars })
    }

    if (action === 'spend-report') {
      const report = await getSpendReport()
      await setState('business_cycle', 'idle')
      return res.json({ report })
    }

    if (action === 'approval-queue') {
      const queue = await getApprovalQueue()
      await setState('business_cycle', 'idle')
      return res.json({ queue })
    }

    if (action === 'approve') {
      const id = String(req.query.id || req.body?.id || '')
      await resolveApproval(id, true)
      await setState('business_cycle', 'idle')
      return res.json({ success: true })
    }

    if (action === 'deny') {
      const id = String(req.query.id || req.body?.id || '')
      await resolveApproval(id, false)
      await setState('business_cycle', 'idle')
      return res.json({ success: true })
    }

    if (action === 'credentials') {
      const autonomyLevel = await getState('autonomy_level')
      const checks = {
        openai: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'placeholder'),
        anthropic: !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder'),
        square: !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_ACCESS_TOKEN !== 'placeholder'),
        sendgrid: !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'placeholder'),
        replicate: !!(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN !== 'placeholder'),
        autonomy_level: autonomyLevel || '1'
      }
      await setState('business_cycle', 'idle')
      return res.json(checks)
    }

    if (action === 'research') { const r = await runResearch(); await setState('business_cycle', 'idle'); return res.json(r) }

    if (action === 'product') {
      const research = await runResearch()
      const product = await createProduct(research)
      await setState('business_cycle', 'idle')
      return res.json(product)
    }

    if (action === 'list') {
      const { data: products } = await db.from('products').select('*').is('gumroad_url', null).order('created_at', { ascending: false }).limit(1)
      if (!products || products.length === 0) { await setState('business_cycle', 'idle'); return res.json({ error: 'No unlisted products.' }) }
      const p = products[0]
      const result = await listProduct({ id: p.id, name: p.name, content: p.file_content || '', description: p.description || '', priceCents: p.price_cents, type: p.type })
      await setState('business_cycle', 'idle')
      return res.json(result)
    }

    if (action === 'list-all') {
      const { data: products } = await db.from('products').select('*').not('gumroad_url', 'is', null).order('created_at', { ascending: false }).limit(1)
      if (!products || products.length === 0) { await setState('business_cycle', 'idle'); return res.json({ error: 'No listed products.' }) }
      const p = products[0]
      const result = await listOnAllMarketplaces({ id: p.id, name: p.name, description: p.description || '', priceCents: p.price_cents, content: p.file_content || '' })
      await setState('business_cycle', 'idle')
      return res.json(result)
    }

    if (action === 'marketing') {
      const { data: products } = await db.from('products').select('*').not('gumroad_url', 'is', null).order('created_at', { ascending: false }).limit(1)
      if (!products || products.length === 0) { await setState('business_cycle', 'idle'); return res.json({ error: 'No listed products.' }) }
      const p = products[0]
      const result = await runMarketing({ id: p.id, name: p.name, description: p.description || '', gumroadUrl: p.gumroad_url || '', targetAudience: 'entrepreneurs', priceCents: p.price_cents })
      await setState('business_cycle', 'idle')
      return res.json(result)
    }

    if (action === 'seo') {
      const { data: products } = await db.from('products').select('*').order('created_at', { ascending: false }).limit(1)
      if (!products || products.length === 0) { await setState('business_cycle', 'idle'); return res.json({ error: 'No products.' }) }
      const p = products[0]
      const seo = await generateSEOContent({ name: p.name, description: p.description || '', targetAudience: 'entrepreneurs', priceCents: p.price_cents })
      await setState('business_cycle', 'idle')
      return res.json(seo)
    }

    if (action === 'directories') {
      const { data: products } = await db.from('products').select('*').not('gumroad_url', 'is', null).order('created_at', { ascending: false }).limit(1)
      if (!products || products.length === 0) { await setState('business_cycle', 'idle'); return res.json({ error: 'No listed products.' }) }
      const p = products[0]
      const result = await submitToDirectories({ name: p.name, description: p.description || '', url: p.gumroad_url })
      await setState('business_cycle', 'idle')
      return res.json(result)
    }

    if (action === 'sync') { const c = await syncGumroadCustomers(); await updateRevenueTotals(); await setState('business_cycle', 'idle'); return res.json({ synced: c }) }
    if (action === 'report') { await updateRevenueTotals(); const r = await generateReport(); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'nft') { const c = String(req.query.concept || ''); const r = await createNFT(c || undefined); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'crypto') { const c = String(req.query.concept || ''); const r = await createCryptoCampaign(c || undefined); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'deliver') { const d = await deliverPendingOrders(); await setState('business_cycle', 'idle'); return res.json({ delivered: d }) }
    if (action === 'deliver-one') { const id = String(req.query.txId || ''); const r = await deliverOne(id); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'analyze') { const r = await analyzeBusinessCycle(); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'improve') { const r = await selfImprove(); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'ideas') { const i = await findBestProductIdeas(); await setState('business_cycle', 'idle'); return res.json({ ideas: i }) }
    if (action === 'self-update') { const r = await runSelfUpdate(); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'diagnose') { const r = await runPipelineDiagnostic(); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'regenerate-images') { const r = await regenerateAllImages({ dryRun: req.query.dry === 'true' }); await setState('business_cycle', 'idle'); return res.json(r) }

    if (action === 'claude-review') {
      const productId = String(req.query.productId || req.body?.productId || '')
      const r = await claudeReviewProduct(productId)
      await setState('business_cycle', 'idle')
      return res.json(r)
    }

    if (action === 'auth-init') { const r = await initDefaultAuthorizations(); await setState('business_cycle', 'idle'); return res.json({ result: r }) }
    if (action === 'auth-report') { const r = await generateAuthReport(); await setState('business_cycle', 'idle'); return res.json({ report: r }) }
    if (action === 'identity-get') {
      const identity = await getIdentity()
      await setState('business_cycle', 'idle')
      return res.json(identity)
    }

    if (action === 'identity-set') {
      await saveIdentity(req.body || {})
      await setState('business_cycle', 'idle')
      return res.json({ success: true })
    }

    if (action === 'signup-kit') {
      const platformId = String(req.query.platform || '')
      const platformName = String(req.query.name || platformId)
      const signupUrl = String(req.query.signupUrl || '')
      const apiKeyUrl = String(req.query.apiKeyUrl || '')
      const identity = await getIdentity()
      const kit = buildSignupKit(platformId, platformName, signupUrl, apiKeyUrl, identity)
      await setState('business_cycle', 'idle')
      return res.json(kit)
    }
    if (action === 'learn-100' || action === 'learn-start-100') { const m = await startLearningPath(100); await setState('business_cycle', 'idle'); return res.json({ message: m }) }
    if (action === 'learn-1000' || action === 'learn-start-1000') { const m = await startLearningPath(1000); await setState('business_cycle', 'idle'); return res.json({ message: m }) }
    if (action === 'learn-stop') { const m = await stopLearningPath(); await setState('business_cycle', 'idle'); return res.json({ message: m }) }
    if (action === 'learn-step') { const r = await runNextCycle(); await setState('business_cycle', 'idle'); return res.json(r) }
    if (action === 'learn-status') { const s = await getLearningStatus(); await setState('business_cycle', 'idle'); return res.json({ status: s }) }

    if (action === 'music') {
      const gate = await checkSpendGate('music_generation', 'Create music product')
      if (!gate.allowed) { await setState('business_cycle', 'idle'); return res.json({ error: gate.reason }) }
      const concept = String(req.query.concept || '')
      const { createMusicProduct } = await import('../../agents/mediaGeneration')
      const r = await createMusicProduct(concept || undefined)
      await setState('business_cycle', 'idle')
      return res.json(r)
    }

    if (action === 'video') {
      const gate = await checkSpendGate('video_generation', 'Create video product')
      if (!gate.allowed) { await setState('business_cycle', 'idle'); return res.json({ error: gate.reason }) }
      const concept = String(req.query.concept || '')
      const { createVideoProduct } = await import('../../agents/mediaGeneration')
      const r = await createVideoProduct(concept || undefined)
      await setState('business_cycle', 'idle')
      return res.json(r)
    }

    if (action === 'media') {
      const { data: products } = await db.from('products').select('*').not('gumroad_url', 'is', null).order('created_at', { ascending: false }).limit(1)
      if (!products || products.length === 0) { await setState('business_cycle', 'idle'); return res.json({ error: 'No listed products' }) }
      const p = products[0]
      const { generateMarketingAssets } = await import('../../agents/mediaGeneration')
      const r = await generateMarketingAssets({ id: p.id, name: p.name, description: p.description || '', type: p.type, gumroadUrl: p.gumroad_url || '', priceCents: p.price_cents })
      await setState('business_cycle', 'idle')
      return res.json(r)
    }

    if (action === 'qc-approve') {
      const productId = String(req.query.productId || '')
      await db.from('products').update({ art_status: 'approved', approved_at: new Date().toISOString() }).eq('id', productId)
      await setState('business_cycle', 'idle')
      return res.json({ success: true })
    }

    if (action === 'chat') {
      const message = String(req.query.message || '')
      if (!message) { await setState('business_cycle', 'idle'); return res.json({ reply: 'No message' }) }
      try {
        const [stateData, productsData, logsData, txData] = await Promise.allSettled([
          db.from('system_state').select('*'),
          db.from('products').select('id,name,type,price_cents,sales_count,gumroad_url,file_content').order('created_at', { ascending: false }).limit(10),
          db.from('agent_logs').select('agent_name,action,status,error').order('created_at', { ascending: false }).limit(20),
          db.from('transactions').select('amount_cents,status').limit(100)
        ])
        const stateRows = stateData.status === 'fulfilled' ? (stateData.value.data || []) : []
        const products = productsData.status === 'fulfilled' ? (productsData.value.data || []) : []
        const logs = logsData.status === 'fulfilled' ? (logsData.value.data || []) : []
        const txs = txData.status === 'fulfilled' ? (txData.value.data || []) : []
        const stateObj: Record<string, string> = {}
        stateRows.forEach((r: any) => { stateObj[r.key] = r.value })
        const totalRevenue = txs.reduce((s: number, t: any) => s + (t.amount_cents || 0), 0)
        const realProducts = products.filter((p: any) => {
          const c = (p.file_content || '').split('---PRODUCT_CONTENT---')[1] || ''
          return c.split(/\s+/).filter(Boolean).length > 80
        })
        const context = [
          'You are Worker AI. Direct, data-driven.',
          'Revenue: $' + (totalRevenue / 100).toFixed(2) + ' | Transactions: ' + txs.length,
          'Products: ' + products.length + ' total, ' + realProducts.length + ' have real content, ' + products.filter((p: any) => p.gumroad_url).length + ' listed',
          'Autonomy: Level ' + (stateObj.autonomy_level || '1'),
          'Recent errors: ' + logs.filter((l: any) => l.status === 'error').slice(0, 3).map((l: any) => l.agent_name + ':' + l.action).join(', '),
          '', 'User: ' + message, '', 'Answer using this real data. Be specific.'
        ].join('\n')
        const reply = await generateText(context, 800)
        await setState('business_cycle', 'idle')
        return res.json({ reply })
      } catch (e: any) {
        await setState('business_cycle', 'idle')
        return res.json({ reply: 'Chat error: ' + e.message })
      }
    }
    if (action === 'health') {
      const { default: healthHandler } = await import('./health')
      return healthHandler(req, res)
    }

    if (action === 'push-storefronts') {
      const { pushAllStorefronts } = await import('../../agents/storefrontUpdate')
      const r = await pushAllStorefronts()
      await setState('business_cycle', 'idle')
      return res.json(r)
    }
    if (action === 'full-cycle') {
      const results: any = {}
      let research: any = null, product: any = null, listed: any = null

      await setState('business_cycle', 'research')
      try { research = await runResearch(); results.research = research }
      catch (e: any) { results.research = { error: e.message }; await setState('business_cycle', 'idle'); return res.json(results) }

      await setState('business_cycle', 'product')
      try { product = await createProduct(research); results.product = { id: product.id, name: product.name, type: product.type } }
      catch (e: any) { results.product = { error: e.message }; await setState('business_cycle', 'idle'); return res.json(results) }

      await setState('business_cycle', 'list')
      try { listed = await listProduct({ id: product.id, name: product.name, content: product.content || '', description: product.description || '', priceCents: product.priceCents, type: product.type }); results.list = listed }
      catch (e: any) { results.list = { error: e.message } }

      await setState('business_cycle', 'marketing')
      try { results.marketing = await runMarketing({ id: product.id, name: product.name, description: product.description || '', gumroadUrl: listed?.url || '', targetAudience: research.targetAudience || 'entrepreneurs', priceCents: product.priceCents }) }
      catch (e: any) { results.marketing = { error: e.message } }

      await setState('business_cycle', 'nft')
      try { results.nft = await createNFT(product.name + ' collection') } catch (e: any) { results.nft = { error: e.message } }

      await setState('business_cycle', 'deliver')
      try { results.delivered = await deliverPendingOrders() } catch (e: any) { results.delivered = { error: e.message } }

      await setState('business_cycle', 'idle')
      await setState('last_cycle', new Date().toISOString())
      return res.json(results)
    }

    await setState('business_cycle', 'idle')
    return res.json({ error: 'Unknown action: ' + action })
  } catch (e: any) {
    await setState('business_cycle', 'idle')
    return res.status(500).json({ error: e.message })
  }
}
