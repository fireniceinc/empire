import { createClient } from '@supabase/supabase-js'
import { generateText, generateJSON } from '../lib/ai'
import { generateAndSaveImage } from './images'
import { claudeReviewProduct } from './qualityReview'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(name: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: name, action, result, status, error: error || null }) } catch {}
}

const TYPE_SPECS: Record<string, { sections: string[]; minWords: number }> = {
  'prompt-pack': { sections: ['Introduction', '20+ Ready-to-Use Prompts', 'How to Customize', 'Pro Tips'], minWords: 1200 },
  'ebook': { sections: ['Introduction', 'Chapters 1-4', 'Conclusion', 'Resources'], minWords: 2500 },
  'template': { sections: ['Overview', 'The Template', 'Customization Guide', 'Examples'], minWords: 1000 },
  'guide': { sections: ['Introduction', 'Step-by-Step Instructions', 'Common Mistakes', 'Checklist'], minWords: 1500 },
  'digital': { sections: ['Overview', 'Main Content', 'How to Use'], minWords: 1200 }
}

async function generateRealContent(name: string, description: string, type: string, targetAudience: string, lightweight: boolean): Promise<string> {
  const spec = TYPE_SPECS[type] || TYPE_SPECS['digital']
  const minWords = lightweight ? Math.min(400, spec.minWords) : spec.minWords
  const maxTokens = lightweight ? 900 : 3500

  try {
    const content = await generateText(
      'Write COMPLETE content for a digital product someone is paying for.\n' +
      'Name: ' + name + '\nDescription: ' + description + '\nAudience: ' + targetAudience + '\nType: ' + type + '\n\n' +
      'Sections: ' + spec.sections.join(', ') + '\nMinimum length: ' + minWords + ' words\n\n' +
      'This must be genuinely complete and usable, not an outline. Use ## headers for sections. Be specific and actionable.',
      maxTokens
    )
    if (content.split(/\s+/).length < 80) throw new Error('Content too short')
    return content
  } catch (e: any) {
    await logAgent('product', 'content_generation_failed', e.message, 'error')
    return ['## ' + name, '', description, '', '## Overview', 'Designed for ' + targetAudience + '.', '', spec.sections.map(s => '- ' + s).join('\n')].join('\n')
  }
}

export async function createProduct(research: {
  productName?: string; description?: string; targetAudience?: string
  priceCents?: number; productType?: string; lightweight?: boolean
}): Promise<{ id: string; name: string; description: string; type: string; priceCents: number; content: string; claudeVerdict?: string }> {
  await logAgent('product', 'creating', research.productName || 'unnamed', 'success')

  let name = research.productName || ''
  let description = research.description || ''
  let priceCents = research.priceCents || 997
  let type = research.productType || 'digital'
  let targetAudience = research.targetAudience || 'professionals'
  const lightweight = !!research.lightweight

  if (!name) {
    try {
      const parsed = await generateJSON(
        'Design a specific, sellable digital product. Return JSON: {"name":"specific compelling product name","description":"clear description under 150 chars","type":"one of: prompt-pack, ebook, template, guide, digital","targetAudience":"specific audience","priceCents":997}',
        400
      )
      name = String(parsed.name || 'AI Digital Product #' + String(Date.now()).slice(-4))
      description = String(parsed.description || description || 'A digital resource')
      type = String(parsed.type || type)
      targetAudience = String(parsed.targetAudience || targetAudience)
      priceCents = parseInt(String(parsed.priceCents || priceCents)) || priceCents
    } catch (e: any) {
      name = 'AI Productivity Pack #' + String(Date.now()).slice(-4)
      description = 'A comprehensive digital resource for professionals'
      await logAgent('product', 'name_generation_fallback', e.message, 'error')
    }
  }

  await logAgent('product', 'generating_content', name + (lightweight ? ' (lightweight)' : ''), 'success')
  const fullContent = await generateRealContent(name, description, type, targetAudience, lightweight)
  const wordCount = fullContent.split(/\s+/).filter(Boolean).length
  await logAgent('product', 'content_generated', wordCount + ' words', 'success')

  const priceDisplay = '$' + (priceCents / 100).toFixed(2)
  const coverPrompt = 'Professional product cover for: ' + name + '. ' + description.slice(0, 150) + '. Modern minimalist tech style, dark background, glowing accents, premium digital product packaging.'
  const seed = Math.abs(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  const filename = type + '-' + Date.now() + '-' + seed + '.png'

  const imageResult = await generateAndSaveImage(coverPrompt, filename, name, type, priceDisplay, seed)
  await logAgent('product', 'cover_' + imageResult.source, imageResult.url ? 'success' : 'failed', imageResult.url ? 'success' : 'error')

  const fileContent = [imageResult.url || '', '', '---PRODUCT_CONTENT---', fullContent].join('\n')

  let productId = ''
  try {
    const { data: inserted } = await db.from('products').insert({
      name, description, price_cents: priceCents, type, file_content: fileContent, art_status: 'pending'
    }).select()
    productId = inserted && inserted.length > 0 ? inserted[0].id : ''
    await logAgent('product', 'saved', productId, 'success')
  } catch (e: any) {
    await logAgent('product', 'save_failed', e.message, 'error', e.message)
    throw new Error('Failed to save product: ' + e.message)
  }

  let claudeVerdict = ''
  if (productId) {
    try {
      const review = await claudeReviewProduct(productId)
      claudeVerdict = review.verdict + ': ' + review.notes
    } catch (e: any) {
      claudeVerdict = 'review unavailable: ' + e.message
    }
  }

  return { id: productId, name, description, type, priceCents, content: fullContent, claudeVerdict }
}
