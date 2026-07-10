import { createClient } from '@supabase/supabase-js'
import { generateJSON } from '../lib/ai'
import { generateNFTArt, generateAndSaveImage } from './images'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(name: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: name, action, result, status, error: error || null }) } catch {}
}

async function saveMedia(productId: string, mediaType: string, url: string, prompt: string, generator: string): Promise<string> {
  try {
    const { data } = await db.from('product_media').insert({
      product_id: productId, media_type: mediaType, url: url.startsWith('data:') ? null : url,
      base64_data: url.startsWith('data:') ? url : null,
      prompt, generator, status: 'pending'
    }).select()
    return data && data.length > 0 ? data[0].id : ''
  } catch { return '' }
}

export async function createNFT(concept?: string): Promise<{
  name: string; description: string; imageUrl: string
  mintingInstructions: string; productId: string
}> {
  await logAgent('nft', 'start', 'Generating NFT', 'success')

  let nftName = 'FireNice Genesis #' + String(Date.now()).slice(-4)
  let nftDescription = 'A unique AI-generated digital artwork'
  let nftConcept = concept || ''
  let artisticStyle = ''
  let colorPalette = ''
  let mood = ''
  let composition = ''

  try {
    const parsed = await generateJSON(
      'Design a unique, highly detailed NFT concept for a collectible digital artwork series. Be creative and specific — NOT generic.\n\n' +
      (concept ? 'Base concept: ' + concept + '\n\n' : '') +
      'Return JSON with these exact fields:\n' +
      '{"nftName":"unique evocative name with 4-digit number","nftDescription":"compelling collector description under 130 chars","concept":"extremely specific visual description for image AI — describe exactly what is in the scene, what objects, what lighting, what atmosphere","artisticStyle":"specific art movement and technique e.g. neo-expressionist oil painting, ukiyo-e woodblock, glitch art, generative fractal","colorPalette":"5 specific colors with their emotional meaning","mood":"single emotional quality","composition":"describe the spatial layout and focal points","uniqueElement":"one surreal or unexpected element that makes this piece unforgettable"}',
      600
    )
    nftName = String(parsed.nftName || nftName)
    nftDescription = String(parsed.nftDescription || nftDescription)
    nftConcept = String(parsed.concept || '')
    artisticStyle = String(parsed.artisticStyle || 'digital painting')
    colorPalette = String(parsed.colorPalette || '')
    mood = String(parsed.mood || '')
    composition = String(parsed.composition || '')
  } catch (e: any) {
    await logAgent('nft', 'concept_failed', e.message, 'error')
  }

  const dallePrompt = [
    nftConcept || 'a surreal digital landscape with impossible architecture and bioluminescent life forms',
    'Style: ' + (artisticStyle || 'high quality digital art'),
    colorPalette ? 'Colors: ' + colorPalette : '',
    mood ? 'Mood: ' + mood : '',
    composition ? 'Composition: ' + composition : '',
    'NFT digital artwork. Museum quality. Ultra detailed. Award winning. 8K resolution.'
  ].filter(Boolean).join('. ')

  const seed = Math.abs(nftName.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  const filename = 'nft-' + Date.now() + '-' + seed + '.png'

  await logAgent('nft', 'generating_image', 'Prompt: ' + dallePrompt.slice(0, 80), 'success')

  const imageResult = await generateAndSaveImage(dallePrompt, filename, nftName, 'nft', '$25.00', seed)
  const imageUrl = imageResult.url

  await logAgent('nft', 'image_' + imageResult.source, imageUrl ? 'success' : 'failed', imageUrl ? 'success' : 'error')

  const mintingInstructions = [
    '=== NFT MINTING — ' + nftName + ' ===',
    '',
    'ARTWORK DETAILS:',
    'Name: ' + nftName,
    'Description: ' + nftDescription,
    'Style: ' + (artisticStyle || 'Digital Art'),
    'Concept: ' + (nftConcept.slice(0, 200) || 'Generative AI artwork'),
    '',
    'OPENSEA (Free on Polygon):',
    '1. opensea.io — Connect MetaMask wallet',
    '2. Create > New Item',
    '3. Upload the NFT image (download from your purchase)',
    '4. Name: ' + nftName,
    '5. Description: ' + nftDescription,
    '6. Blockchain: Polygon (FREE minting)',
    '7. Royalties: 10%',
    '8. Set sale price $25-$500',
    '',
    'RARIBLE: rarible.com > Create > Single',
    'FOUNDATION: foundation.app (invite-based, premium)',
    '',
    'Suggested price range: $25 (entry) to $500 (premium series)',
    'Edition type: 1/1 unique (maximum collectible value)'
  ].join('\n')

  const generativeSvg = generateNFTArt({ name: nftName, concept: nftConcept, seed })
  const svgBase64 = 'data:image/svg+xml;base64,' + Buffer.from(generativeSvg).toString('base64')

  const fileContent = [
    imageUrl || svgBase64,
    '',
    '---GENERATIVE_SVG_BACKUP---',
    svgBase64,
    '',
    '---MINTING_INSTRUCTIONS---',
    mintingInstructions
  ].join('\n')

  let productId = ''
  try {
    const { data: inserted } = await db.from('products').insert({
      name: nftName,
      description: nftDescription,
      price_cents: 2500,
      type: 'nft',
      file_content: fileContent,
      art_status: 'pending'
    }).select()
    productId = inserted && inserted.length > 0 ? inserted[0].id : ''

    if (productId && imageUrl) {
      await saveMedia(productId, 'nft_artwork', imageUrl, dallePrompt, imageResult.source)
    }

    await logAgent('nft', 'product_saved', productId, 'success')
  } catch (e: any) {
    await logAgent('nft', 'db_failed', e.message, 'error', e.message)
  }

  return { name: nftName, description: nftDescription, imageUrl: imageUrl || svgBase64, mintingInstructions, productId }
}

export async function regenerateNFTArt(productId: string): Promise<{ imageUrl: string; improved: boolean }> {
  const { data: products } = await db.from('products').select('*').eq('id', productId).limit(1)
  if (!products || products.length === 0) return { imageUrl: '', improved: false }
  const product = products[0]

  await db.from('product_media').update({ status: 'replaced' }).eq('product_id', productId).eq('media_type', 'nft_artwork')

  const conceptLines = (product.file_content || '').split('\n')
  const mintingIdx = conceptLines.findIndex((l: string) => l.includes('---MINTING'))
  const mintingText = mintingIdx > -1 ? conceptLines.slice(mintingIdx).join('\n') : ''
  const conceptMatch = mintingText.match(/Concept:\s*(.+)/)?.[1] || product.description || product.name

  let improvedConcept = ''
  try {
    const improved = await generateJSON(
      'The previous NFT artwork for "' + product.name + '" was rejected. Create a dramatically improved concept.\n' +
      'Previous concept: ' + conceptMatch + '\n\n' +
      'Generate something visually striking, unique, and collectible. Think museum-quality digital art.\n' +
      'Return JSON: {"concept":"extremely detailed improved visual description","artisticStyle":"specific art style","enhancement":"what makes this version better than the last"}',
      400
    )
    improvedConcept = String(improved.concept || '')
  } catch {}

  const seed = Date.now() % 999999
  const filename = 'nft-regen-' + productId.slice(-8) + '-' + seed + '.png'
  const prompt = (improvedConcept || conceptMatch) + '. NFT artwork. Museum quality. Ultra detailed. 8K.'

  const result = await generateAndSaveImage(prompt, filename, product.name, 'nft', '$25.00', seed)

  if (result.url) {
    const generativeSvg = generateNFTArt({ name: product.name, concept: improvedConcept || conceptMatch, seed })
    const svgBase64 = 'data:image/svg+xml;base64,' + Buffer.from(generativeSvg).toString('base64')
    const newContent = [result.url, '', '---GENERATIVE_SVG_BACKUP---', svgBase64, '', mintingIdx > -1 ? mintingText : product.file_content || ''].join('\n')
    await db.from('products').update({ file_content: newContent, art_status: 'pending' }).eq('id', productId)
    await saveMedia(productId, 'nft_artwork', result.url, prompt, result.source)
    return { imageUrl: result.url, improved: true }
  }

  return { imageUrl: '', improved: false }
}
