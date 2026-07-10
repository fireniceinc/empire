import { createClient } from '@supabase/supabase-js'
import { generateJSON } from '../lib/ai'
import { generateSEOContent } from './marketplace'
import { publishToAllAvailable } from './socialPublish'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(name: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try {
    await db.from('agent_logs').insert({ agent_name: name, action, result, status, error: error || null })
  } catch {}
}

export async function runMarketing(product: {
  id: string
  name: string
  description: string
  gumroadUrl: string
  targetAudience: string
  priceCents: number
}): Promise<{ campaignIds: string[]; actuallyPosted: string[] }> {
  await logAgent('marketing', 'start', product.name, 'success')

  const priceDisplay = '$' + (product.priceCents / 100).toFixed(2)
  let content: any = null

  try {
    content = await generateJSON(
      'Generate marketing content for: ' + product.name + '. Description: ' + product.description + '. Price: ' + priceDisplay + '. URL: ' + product.gumroadUrl + '. Audience: ' + product.targetAudience +
      '\n\nReturn JSON: {"shortPitch":"under 200 char compelling pitch","title":"compelling title","socialPost":"one paragraph social media post under 400 chars"}',
      800
    )
  } catch {}

  if (!content) {
    content = {
      shortPitch: product.description.slice(0, 180),
      title: 'Just launched: ' + product.name,
      socialPost: product.name + ' - ' + product.description.slice(0, 200) + ' Only ' + priceDisplay + '.'
    }
  }

  const campaignIds: string[] = []
  const actuallyPosted: string[] = []

  const publishResult = await publishToAllAvailable({
    title: content.title,
    url: product.gumroadUrl,
    content: content.socialPost
  })

  actuallyPosted.push(...publishResult.posted)

  try {
    const { data } = await db.from('marketing_campaigns').insert({
      platform: actuallyPosted.length > 0 ? actuallyPosted.join('+') : 'share_ready',
      content: content.socialPost,
      url: product.gumroadUrl,
      status: actuallyPosted.length > 0 ? 'posted' : 'ready_for_share',
      product_id: product.id
    }).select()
    if (data && data.length > 0) campaignIds.push(data[0].id)
  } catch {}

  try {
    const shareEntries = [
      { platform: 'reddit_share', url: publishResult.shareIntents.reddit },
      { platform: 'twitter_share', url: publishResult.shareIntents.twitter },
      { platform: 'linkedin_share', url: publishResult.shareIntents.linkedin },
      { platform: 'hackernews_share', url: publishResult.shareIntents.hackerNews },
      { platform: 'whatsapp_share', url: publishResult.shareIntents.whatsapp },
      { platform: 'telegram_share', url: publishResult.shareIntents.telegram }
    ]
    for (const entry of shareEntries) {
      const { data } = await db.from('marketing_campaigns').insert({
        platform: entry.platform,
        content: content.socialPost,
        url: entry.url,
        status: 'ready_for_share',
        product_id: product.id
      }).select()
      if (data && data.length > 0) campaignIds.push(data[0].id)
    }
  } catch {}

  try {
    const seoContent = await generateSEOContent({
      name: product.name,
      description: product.description,
      targetAudience: product.targetAudience,
      priceCents: product.priceCents
    })
    await db.from('marketing_campaigns').insert({
      platform: 'seo',
      content: JSON.stringify(seoContent),
      url: product.gumroadUrl,
      status: 'ready',
      product_id: product.id
    })
  } catch {}

  await logAgent('marketing', 'complete', actuallyPosted.length + ' real posts, ' + campaignIds.length + ' campaigns logged', 'success')

  return { campaignIds, actuallyPosted }
}
