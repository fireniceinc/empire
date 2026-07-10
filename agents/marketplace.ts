import { createClient } from '@supabase/supabase-js'
import { generateText } from '../lib/ai'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(agentName: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: agentName, action, result, status, error: error || null }) } catch {}
}

async function tryPayhip(name: string, description: string, priceCents: number, fileContent: string): Promise<{ url: string; platform: string } | null> {
  const key = process.env.PAYHIP_API_KEY
  if (!key || key === 'placeholder') return null
  try {
    const formData = new FormData()
    formData.append('title', name)
    formData.append('description', description)
    formData.append('price', (priceCents / 100).toFixed(2))
    formData.append('currency', 'USD')
    const blob = new Blob([fileContent], { type: 'text/plain' })
    formData.append('file', blob, name.replace(/\s+/g, '-') + '.txt')
    const r = await fetch('https://payhip.com/api/v1/product', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key }
    })
    if (!r.ok) return null
    const d = await r.json()
    const url = d.data?.link || 'https://payhip.com/b/' + (d.data?.hashkey || '')
    await logAgent('marketplace', 'payhip_listed', url, 'success')
    return { url, platform: 'payhip' }
  } catch { return null }
}

async function tryEtsy(name: string, description: string, priceCents: number): Promise<{ url: string; platform: string } | null> {
  const key = process.env.ETSY_API_KEY
  const shopId = process.env.ETSY_SHOP_ID
  if (!key || !shopId || key === 'placeholder') return null
  try {
    const r = await fetch('https://openapi.etsy.com/v3/application/shops/' + shopId + '/listings', {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: 999,
        title: name.slice(0, 140),
        description,
        price: (priceCents / 100).toFixed(2),
        who_made: 'i_did',
        when_made: 'made_to_order',
        taxonomy_id: 2078,
        type: 'download',
        is_digital: true,
        is_personalizable: false
      })
    })
    if (!r.ok) return null
    const d = await r.json()
    const listingId = d.listing_id
    if (!listingId) return null
    const url = 'https://www.etsy.com/listing/' + listingId
    await logAgent('marketplace', 'etsy_listed', url, 'success')
    return { url, platform: 'etsy' }
  } catch { return null }
}

async function tryEbay(name: string, description: string, priceCents: number): Promise<{ url: string; platform: string } | null> {
  const token = process.env.EBAY_OAUTH_TOKEN
  if (!token || token === 'placeholder') return null
  try {
    const r = await fetch('https://api.ebay.com/sell/inventory/v1/inventory_item/' + Date.now(), {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Language': 'en-US' },
      body: JSON.stringify({
        product: {
          title: name.slice(0, 80),
          description,
          aspects: { 'Type': ['Digital Download'], 'Format': ['PDF/Text'] }
        },
        condition: 'NEW',
        availability: { shipToLocationAvailability: { quantity: 9999 } }
      })
    })
    if (!r.ok) return null
    await logAgent('marketplace', 'ebay_item_created', name, 'success')
    return { url: 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(name), platform: 'ebay' }
  } catch { return null }
}

export async function listOnAllMarketplaces(product: {
  id: string
  name: string
  description: string
  priceCents: number
  content: string
}): Promise<{ platforms: string[]; urls: string[] }> {
  await logAgent('marketplace', 'listing_all', product.name, 'success')

  const results: { url: string; platform: string }[] = []
  const attempts = [
    tryPayhip(product.name, product.description, product.priceCents, product.content),
    tryEtsy(product.name, product.description, product.priceCents),
    tryEbay(product.name, product.description, product.priceCents)
  ]

  const settled = await Promise.allSettled(attempts)
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) results.push(r.value)
  }

  if (results.length > 0) {
    const urlList = results.map(r => r.platform + ':' + r.url).join(',')
    const currentUrl = (await db.from('products').select('gumroad_url').eq('id', product.id).limit(1)).data?.[0]?.gumroad_url || ''
    await db.from('products').update({
      gumroad_url: currentUrl || results[0].url
    }).eq('id', product.id)
  }

  await logAgent('marketplace', 'listed_all', results.length + ' platforms', 'success')
  return { platforms: results.map(r => r.platform), urls: results.map(r => r.url) }
}

export async function generateSEOContent(product: {
  name: string
  description: string
  targetAudience: string
  priceCents: number
}): Promise<{
  title: string
  metaDescription: string
  keywords: string[]
  googleAdsHeadlines: string[]
  googleAdsDescriptions: string[]
  longTailKeywords: string[]
  blogPostOutline: string
}> {
  await logAgent('marketplace', 'seo_generation', product.name, 'success')

  try {
    const text = await generateText(
      'Generate complete SEO and Google Ads content for this digital product.\nProduct: ' + product.name + '\nDescription: ' + product.description + '\nAudience: ' + product.targetAudience + '\nPrice: $' + (product.priceCents / 100).toFixed(2) + '\n\nReturn JSON: {"title":"SEO optimized title under 60 chars","metaDescription":"under 155 chars","keywords":["kw1","kw2","kw3","kw4","kw5"],"googleAdsHeadlines":["headline1 under 30 chars","headline2","headline3","headline4","headline5"],"googleAdsDescriptions":["description1 under 90 chars","description2"],"longTailKeywords":["long tail 1","long tail 2","long tail 3"],"blogPostOutline":"Complete outline for a blog post that naturally promotes this product"}',
      2048
    )
    const clean = text.replace(/^```(?:json)?\n?/gm, '').replace(/```$/gm, '').trim()
    const parsed = JSON.parse(clean)
    await logAgent('marketplace', 'seo_complete', parsed.title, 'success')
    return parsed
  } catch (e: any) {
    await logAgent('marketplace', 'seo_failed', e.message, 'error', e.message)
    return {
      title: product.name,
      metaDescription: product.description.slice(0, 155),
      keywords: [product.name, product.targetAudience, 'digital download', 'AI generated', 'productivity'],
      googleAdsHeadlines: [product.name.slice(0, 30), 'Download Instantly', 'Only $' + (product.priceCents / 100).toFixed(2), 'AI-Generated Content', 'Professional Quality'],
      googleAdsDescriptions: [product.description.slice(0, 90), 'Get instant access to ' + product.name + ' for just $' + (product.priceCents / 100).toFixed(2)],
      longTailKeywords: ['buy ' + product.name.toLowerCase(), product.name.toLowerCase() + ' download', 'best ' + product.targetAudience + ' tools'],
      blogPostOutline: 'Introduction -> Problem -> Solution (' + product.name + ') -> Benefits -> Call to Action'
    }
  }
}

export async function submitToDirectories(product: {
  name: string
  description: string
  url: string
}): Promise<{ submitted: string[]; instructions: string }> {
  const submitted: string[] = []

  const directories = [
    { name: 'Product Hunt', url: 'https://www.producthunt.com/posts/new', manual: true },
    { name: 'Hacker News Show HN', url: 'https://news.ycombinator.com/submit', manual: true },
    { name: 'BetaList', url: 'https://betalist.com/submit', manual: true },
    { name: 'IndieHackers', url: 'https://www.indiehackers.com/product/new', manual: true },
    { name: 'AppSumo', url: 'https://appsumo.com/vendor', manual: true }
  ]

  const instructions = [
    'DIRECTORY SUBMISSION GUIDE',
    '',
    'Product: ' + product.name,
    'URL: ' + product.url,
    '',
    'Submit to these directories for free traffic:',
    ''
  ]

  for (const dir of directories) {
    instructions.push(dir.name + ': ' + dir.url)
    submitted.push(dir.name)
  }

  instructions.push('')
  instructions.push('COPY-PASTE DESCRIPTION:')
  instructions.push(product.description)

  await logAgent('marketplace', 'directory_guide', submitted.length + ' directories', 'success')
  return { submitted, instructions: instructions.join('\n') }
}
