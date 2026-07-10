import { createClient } from '@supabase/supabase-js'
import { generateJSON } from '../lib/ai'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(agentName: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: agentName, action, result, status, error: error || null }) } catch {}
}

export async function runResearch(): Promise<{
  opportunity: string
  productName: string
  description: string
  targetAudience: string
  priceCents: number
  productType: string
}> {
  await logAgent('research', 'start', 'Scanning market opportunities', 'success')
  try {
    const parsed = await generateJSON(
      'You are a market research agent for an AI business. Identify ONE high-demand low-competition digital product AI can create 100% autonomously. Best options right now: ChatGPT prompt packs, productivity templates, AI tool guides, social media content kits, business plan templates, resume templates, crypto/NFT guides. Pick the strongest demand item. Return JSON: {"productName":"...","description":"...","targetAudience":"...","priceCents":997,"productType":"prompt-pack"} where productType is one of: prompt-pack, ebook, template, guide, art-collection',
      512
    )
    const opportunity = String(parsed.productName || 'AI Prompts') + ' for ' + String(parsed.targetAudience || 'professionals')
    await logAgent('research', 'opportunity_found', opportunity, 'success')
    return {
      opportunity,
      productName: String(parsed.productName || '50 AI Prompts for Entrepreneurs'),
      description: String(parsed.description || 'High-value AI prompts for business owners'),
      targetAudience: String(parsed.targetAudience || 'entrepreneurs'),
      priceCents: Number(parsed.priceCents) || 997,
      productType: String(parsed.productType || 'prompt-pack')
    }
  } catch (e: any) {
    await logAgent('research', 'fallback', 'Using default: ' + e.message, 'success')
    return {
      opportunity: 'AI prompts for entrepreneurs',
      productName: '50 AI Prompts for Entrepreneurs',
      description: 'A curated collection of high-value AI prompts for entrepreneurs and business owners. Save hours of work with these ready-to-use prompts.',
      targetAudience: 'entrepreneurs and small business owners',
      priceCents: 997,
      productType: 'prompt-pack'
    }
  }
}
