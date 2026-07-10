import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { syncGumroadCustomers } from '../../agents/customerService'
import { updateRevenueTotals } from '../../agents/accounting'
import { runResearch } from '../../agents/research'
import { createProduct } from '../../agents/product'
import { listProduct } from '../../agents/storefront'
import { runMarketing } from '../../agents/marketing'
import { deliverPendingOrders } from '../../agents/delivery'
import { analyzeBusinessCycle, selfImprove } from '../../agents/analytics'
import { createNFT } from '../../agents/nft'
import { runNextCycle } from '../../agents/learningPath'

export const config = { api: { bodyParser: { sizeLimit: '4mb' } }, maxDuration: 60 }

const db = createClient(process.env.SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_KEY || 'placeholder')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && cronSecret !== 'placeholder') {
    const auth = req.headers.authorization
    if (auth !== 'Bearer ' + cronSecret && req.query.secret !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return res.json({ ok: false, reason: 'No AI provider configured' })
  }

  const actions: string[] = []
  const errors: string[] = []

  async function run(name: string, fn: () => Promise<any>): Promise<any> {
    try { const r = await fn(); actions.push(name); return r }
    catch (e: any) { errors.push(name + ': ' + e.message); return null }
  }

  try {
    const { data: stateData } = await db.from('system_state').select('*')
    const state: Record<string, string> = {}
    if (stateData) stateData.forEach((r: any) => { state[r.key] = r.value })
    const level = parseInt(state.autonomy_level || process.env.AUTONOMY_LEVEL || '1')

    // Cheap, always run
    await run('sync_sales', () => syncGumroadCustomers())
    await run('deliver_pending', () => deliverPendingOrders())

    if (level >= 2) {
      const counter = parseInt(state.cron_cycle_counter || '0') + 1
      await db.from('system_state').upsert({ key: 'cron_cycle_counter', value: String(counter), updated_at: new Date().toISOString() })
      const rotation = counter % 4

      if (rotation === 0) {
        const { data: activeProds } = await db.from('products').select('id').not('gumroad_url', 'is', null)
        if ((activeProds || []).length < 10) {
          const research = await run('research', () => runResearch())
          if (research) {
            const product = await run('create_product', () => createProduct(research))
            if (product) {
              const listed = await run('list_product', () => listProduct({ id: product.id, name: product.name, content: product.content || '', description: product.description || '', priceCents: product.priceCents, type: product.type }))
              if (listed) await run('marketing', () => runMarketing({ id: product.id, name: product.name, description: product.description || '', gumroadUrl: listed.url, targetAudience: research.targetAudience || 'entrepreneurs', priceCents: product.priceCents }))
            }
          }
        }
      } else if (rotation === 1) {
        const learningState = state.learning_state ? JSON.parse(state.learning_state) : null
        if (learningState && learningState.status === 'running') {
          const result = await run('learning_step', () => runNextCycle())
          if (result) actions.push('learn_cycle_' + result.cycleNum + ':' + (result.productName || 'none'))
        }
      } else if (rotation === 2) {
        const { data: nftProds } = await db.from('products').select('id').eq('type', 'nft')
        if ((nftProds || []).length < 5) await run('create_nft', () => createNFT())
      } else if (rotation === 3) {
        const lastAnalysis = state.last_analysis ? new Date(state.last_analysis) : null
        const hoursSince = lastAnalysis ? (Date.now() - lastAnalysis.getTime()) / 3600000 : 999
        if (hoursSince > 24) {
          await run('analyze', () => analyzeBusinessCycle())
          await db.from('system_state').upsert({ key: 'last_analysis', value: new Date().toISOString(), updated_at: new Date().toISOString() })
        }
      }
    }

    if (level >= 3) {
      const improveCounter = parseInt(state.improve_counter || '0') + 1
      await db.from('system_state').upsert({ key: 'improve_counter', value: String(improveCounter), updated_at: new Date().toISOString() })
      if (improveCounter % 6 === 0) await run('self_improve', () => selfImprove())
    }

    await db.from('system_state').upsert({ key: 'last_cron', value: new Date().toISOString(), updated_at: new Date().toISOString() })
    return res.json({ ok: true, level, actions, errors, timestamp: new Date().toISOString() })
  } catch (e: any) {
    return res.json({ ok: false, error: e.message, actions, errors })
  }
}
