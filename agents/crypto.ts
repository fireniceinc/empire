import { createClient } from '@supabase/supabase-js'
import { generateText, generateJSON } from '../lib/ai'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(name: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: name, action, result, status, error: error || null }) } catch {}
}

export async function createCryptoCampaign(concept?: string): Promise<{
  tokenName: string
  ticker: string
  whitepaper: string
  launchPlan: string
  socialContent: string
  technicalSpecs: string
  productId: string
}> {
  await logAgent('crypto', 'start', 'Creating crypto campaign', 'success')

  let tokenConcept = concept || 'AI-powered utility token for digital content creators and autonomous business systems'

  try {
    const specs = await generateJSON(
      'Design a cryptocurrency token concept for this use case: ' + tokenConcept + '\n\nReturn JSON: {"tokenName":"Full Token Name","ticker":"3-5 letter ticker symbol","tagline":"one sentence value proposition","useCase":"specific utility","totalSupply":"token supply number","initialPrice":"launch price in USD","blockchain":"Solana","launchPlatform":"pump.fun or Moonshot"}',
      400
    )

    const tokenName = String(specs.tokenName || 'FireNice Token')
    const ticker = String(specs.ticker || 'FRNC')
    const blockchain = String(specs.blockchain || 'Solana')
    const supply = String(specs.totalSupply || '1,000,000,000')
    const launchPlatform = String(specs.launchPlatform || 'pump.fun')

    const whitepaper = await generateText(
      'Write a complete cryptocurrency whitepaper for ' + tokenName + ' (' + ticker + ').\n\nBlockchain: ' + blockchain + '\nTotal Supply: ' + supply + '\nUse Case: ' + specs.useCase + '\nTagline: ' + specs.tagline + '\n\nInclude: Executive Summary, Problem Statement, Solution, Token Utility, Tokenomics, Roadmap (4 phases), Team section (AI-driven), Technical Implementation, Legal Disclaimer.\n\nMake it professional and investment-grade.',
      4096
    )

    const launchPlan = await generateText(
      'Create a complete 30-day launch plan for ' + tokenName + ' (' + ticker + ') on ' + launchPlatform + '.\n\nInclude:\n- Pre-launch checklist\n- Launch day timeline\n- Community building strategy\n- Marketing channels\n- Liquidity strategy\n- Price targets\n- Risk management\n\nBe specific and actionable.',
      2048
    )

    const socialContent = await generateText(
      'Create complete social media launch content for ' + tokenName + ' (' + ticker + ').\n\nCreate:\n1. Twitter/X announcement thread (10 tweets)\n2. Telegram announcement message\n3. Discord launch announcement\n4. Reddit post for r/CryptoMoonShots and r/SatoshiStreetBets\n5. Five unique hashtag sets\n6. Influencer outreach message template\n\nMake it compelling and viral-worthy.',
      2048
    )

    const technicalSpecs = [
      'TECHNICAL SPECIFICATIONS — ' + tokenName + ' (' + ticker + ')',
      '',
      'Blockchain: ' + blockchain,
      'Token Standard: ' + (blockchain === 'Solana' ? 'SPL Token' : 'ERC-20'),
      'Total Supply: ' + supply,
      'Decimals: 9',
      'Launch Platform: ' + launchPlatform,
      '',
      'LAUNCH STEPS:',
      '',
      'Option 1 — pump.fun (Solana, easiest, free):',
      '1. Go to pump.fun',
      '2. Connect Phantom wallet',
      '3. Click "Create a new coin"',
      '4. Name: ' + tokenName,
      '5. Ticker: ' + ticker,
      '6. Upload logo (use FireNice logo)',
      '7. Description: ' + (specs.tagline || tokenConcept),
      '8. Cost: ~0.02 SOL (~$3)',
      '9. Click Deploy',
      '10. Share contract address everywhere',
      '',
      'Option 2 — Moonshot (more professional):',
      '1. Go to moonshot.money',
      '2. Connect wallet',
      '3. Fill token details',
      '4. Launch with built-in fair launch mechanism',
      '',
      'Option 3 — Solana with Metaplex (most control):',
      '1. Install Solana CLI',
      '2. Create token: spl-token create-token',
      '3. Create account: spl-token create-account [token]',
      '4. Mint: spl-token mint [token] ' + supply.replace(/,/g, ''),
      '5. List on DEX (Raydium or Orca)',
      '',
      'COINBASE COMMERCE (accept crypto payments immediately):',
      '1. Go to commerce.coinbase.com',
      '2. Create account',
      '3. Create a charge for ' + tokenName,
      '4. Add to FireNice store',
      '5. Accept BTC, ETH, SOL, USDC instantly',
      '',
      'CONTRACT ADDRESS: Deploy first, then add here',
      'DEX: Raydium.io or Jupiter.ag',
      'Chart: dexscreener.com',
      'Community: Telegram + Discord'
    ].join('\n')

    const fileContent = [
      '=== ' + tokenName + ' (' + ticker + ') COMPLETE LAUNCH PACKAGE ===',
      '',
      '=== WHITEPAPER ===',
      whitepaper,
      '',
      '=== LAUNCH PLAN ===',
      launchPlan,
      '',
      '=== SOCIAL MEDIA CONTENT ===',
      socialContent,
      '',
      '=== TECHNICAL SPECS ===',
      technicalSpecs
    ].join('\n')

    let productId = ''
    try {
      const { data: inserted } = await db.from('products').insert({
        name: tokenName + ' (' + ticker + ') Complete Launch Package',
        description: 'Complete cryptocurrency launch package including whitepaper, tokenomics, launch plan, social content, and technical specifications for ' + tokenName,
        price_cents: 4997,
        type: 'crypto',
        file_content: fileContent
      }).select()
      productId = inserted && inserted.length > 0 ? inserted[0].id : ''
    } catch {}

    await logAgent('crypto', 'campaign_created', tokenName, 'success')

    return { tokenName, ticker, whitepaper, launchPlan, socialContent, technicalSpecs, productId }

  } catch (e: any) {
    await logAgent('crypto', 'failed', e.message, 'error', e.message)
    return {
      tokenName: 'FireNice Token',
      ticker: 'FRNC',
      whitepaper: 'Generation failed: ' + e.message,
      launchPlan: '',
      socialContent: '',
      technicalSpecs: '',
      productId: ''
    }
  }
}

export async function createCoinbaseCommerceCharge(name: string, description: string, priceCents: number): Promise<{ id: string; url: string } | null> {
  const key = process.env.COINBASE_COMMERCE_API_KEY
  if (!key || key === 'placeholder') return null
  try {
    const r = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: { 'X-CC-Api-Key': key, 'X-CC-Version': '2018-03-22', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        pricing_type: 'fixed_price',
        local_price: { amount: (priceCents / 100).toFixed(2), currency: 'USD' },
        metadata: { product_name: name }
      })
    })
    if (!r.ok) return null
    const d = await r.json()
    return { id: d.data?.code || '', url: d.data?.hosted_url || '' }
  } catch { return null }
}
