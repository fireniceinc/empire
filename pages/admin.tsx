import { useState, useEffect } from 'react'

const S = {
  bg: '#050510', card: 'rgba(10,12,40,0.95)', border: 'rgba(100,120,255,0.2)',
  glow: '#4466ff', green: '#00ffaa', text: '#d0d8ff', dim: '#4455aa',
  accent: '#aa66ff', red: '#ff4466', yellow: '#ffaa00', font: 'ui-monospace, monospace'
}

const SECTIONS = ['dashboard', 'products', 'ideas', 'crypto', 'platforms', 'legal', 'ai-config', 'marketing', 'settings']

const ALL_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', category: 'social', icon: '📸', signupUrl: 'https://www.instagram.com/accounts/emailsignup/', apiUrl: 'https://developers.facebook.com/apps/', keyName: 'INSTAGRAM_TOKEN', freeSetup: true, desc: 'Visual product posts, NFT showcases' },
  { id: 'tiktok', name: 'TikTok', category: 'social', icon: '🎵', signupUrl: 'https://www.tiktok.com/signup', apiUrl: 'https://developers.tiktok.com/', keyName: 'TIKTOK_ACCESS_TOKEN', freeSetup: true, desc: 'Short video demos, viral marketing' },
  { id: 'pinterest', name: 'Pinterest', category: 'social', icon: '📌', signupUrl: 'https://www.pinterest.com/join/', apiUrl: 'https://developers.pinterest.com/', keyName: 'PINTEREST_ACCESS_TOKEN', freeSetup: true, desc: 'Product images, visual catalog' },
  { id: 'reddit', name: 'Reddit', category: 'social', icon: '🔴', signupUrl: 'https://www.reddit.com/register/', apiUrl: 'https://www.reddit.com/prefs/apps', keyName: 'REDDIT_CLIENT_ID', freeSetup: true, desc: 'Community posts, entrepreneur subreddits' },
  { id: 'twitter', name: 'Twitter/X', category: 'social', icon: '🐦', signupUrl: 'https://twitter.com/i/flow/signup', apiUrl: 'https://developer.twitter.com/', keyName: 'TWITTER_BEARER_TOKEN', freeSetup: false, desc: 'Product announcements, NFT drops' },
  { id: 'linkedin', name: 'LinkedIn', category: 'social', icon: '💼', signupUrl: 'https://www.linkedin.com/signup/', apiUrl: 'https://www.linkedin.com/developers/apps', keyName: 'LINKEDIN_TOKEN', freeSetup: true, desc: 'B2B products, professional templates' },
  { id: 'mastodon', name: 'Mastodon', category: 'social', icon: '🐘', signupUrl: 'https://mastodon.social/auth/sign_up', apiUrl: 'https://mastodon.social/settings/applications', keyName: 'MASTODON_ACCESS_TOKEN', freeSetup: true, desc: 'No approval needed, instant setup' },
  { id: 'payhip', name: 'Payhip', category: 'storefront', icon: '🛍', signupUrl: 'https://payhip.com/signup', apiUrl: 'https://payhip.com/settings/api', keyName: 'PAYHIP_API_KEY', freeSetup: true, desc: 'Zero fees, instant PayPal payouts' },
  { id: 'gumroad', name: 'Gumroad', category: 'storefront', icon: '💰', signupUrl: 'https://gumroad.com/signup', apiUrl: 'https://app.gumroad.com/settings/advanced', keyName: 'GUMROAD_ACCESS_TOKEN', freeSetup: true, desc: 'Popular digital product marketplace' },
  { id: 'etsy', name: 'Etsy', category: 'storefront', icon: '🎨', signupUrl: 'https://www.etsy.com/sell', apiUrl: 'https://www.etsy.com/developers/register', keyName: 'ETSY_API_KEY', freeSetup: true, desc: 'Templates and digital downloads' },
  { id: 'producthunt', name: 'Product Hunt', category: 'directory', icon: '🚀', signupUrl: 'https://www.producthunt.com/auth/signup', apiUrl: 'https://api.producthunt.com/v2/oauth/applications', keyName: 'PRODUCTHUNT_TOKEN', freeSetup: true, desc: 'Launch day traffic boost' },
  { id: 'replicate', name: 'Replicate', category: 'ai', icon: '🤖', signupUrl: 'https://replicate.com/signin', apiUrl: 'https://replicate.com/account/api-tokens', keyName: 'REPLICATE_API_TOKEN', freeSetup: true, desc: 'Music, video, uncensored image AI' },
  { id: 'coinbase', name: 'Coinbase Commerce', category: 'payment', icon: '₿', signupUrl: 'https://commerce.coinbase.com/signup', apiUrl: 'https://commerce.coinbase.com/settings/security', keyName: 'COINBASE_COMMERCE_API_KEY', freeSetup: true, desc: 'Accept crypto payments' },
  { id: 'sendgrid', name: 'SendGrid', category: 'email', icon: '📧', signupUrl: 'https://signup.sendgrid.com/', apiUrl: 'https://app.sendgrid.com/settings/api_keys', keyName: 'SENDGRID_API_KEY', freeSetup: true, desc: '100 free emails/day for product delivery' }
]

export default function Admin() {
  const [section, setSection] = useState('dashboard')
  const [status, setStatus] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [platformAuths, setPlatformAuths] = useState<Record<string, string>>({})
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({})
  const [learningStatus, setLearningStatus] = useState('')

  const [ideaForm, setIdeaForm] = useState({ name: '', type: 'prompt-pack', description: '', targetAudience: '', priceCents: 997, nftConcept: '' })
  const [cryptoForm, setCryptoForm] = useState({ concept: '', tokenName: '', ticker: '' })
  const [legalForm, setLegalForm] = useState({ businessName: 'FireNice', tagline: 'Autonomous AI Digital Commerce', email: '', refundPolicy: '30-day satisfaction guarantee', privacyPolicy: '', termsOfService: '' })

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(d => setStatus(d)).catch(() => {})
    fetch('/api/orchestrate?action=learn-status').then(r => r.json()).then(d => { if (d.status) setLearningStatus(d.status) }).catch(() => {})
  }, [])

  async function apiCall(action: string, body?: any) {
    setBusy(true)
    setMsg('Running ' + action + '...')
    try {
      const opts: RequestInit = body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}
      const r = await fetch('/api/orchestrate?action=' + action, opts)
      const d = await r.json()
      setMsg(JSON.stringify(d, null, 2).slice(0, 800))
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  async function grantPlatformAccess(platformId: string, level: string) {
    setBusy(true)
    try {
      await fetch('/api/orchestrate?action=auth-grant&resource=' + platformId + '&identity=worker-ai&level=' + level)
      setPlatformAuths(prev => ({ ...prev, [platformId]: level }))
      setMsg('Access ' + level + ' granted to ' + platformId)
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  async function revokePlatformAccess(platformId: string) {
    setBusy(true)
    try {
      await fetch('/api/orchestrate?action=auth-revoke&resource=' + platformId + '&identity=worker-ai')
      setPlatformAuths(prev => { const n = { ...prev }; delete n[platformId]; return n })
      setMsg('Access revoked for ' + platformId)
    } catch {}
    setBusy(false)
  }

  async function saveApiKey(platformId: string, keyName: string) {
    const value = apiKeyInputs[platformId]
    if (!value) return
    setBusy(true)
    try {
      const r = await fetch('/api/setenv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envBlock: keyName + '=' + value })
      })
      const d = await r.json()
      if (d.ok) {
        setMsg('Saved ' + keyName + '. Redeploy worker for it to take effect.')
        setApiKeyInputs(prev => ({ ...prev, [platformId]: '' }))
        await grantPlatformAccess(platformId, 'full')
      } else {
        setMsg('Save failed: ' + d.error)
      }
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }

  const btn = (label: string, onClick: () => void, color = S.glow, disabled = false) => (
    <button onClick={onClick} disabled={disabled || busy} style={{
      background: color + '22', border: '1px solid ' + color + '55',
      borderRadius: 8, color, padding: '9px 14px', cursor: busy ? 'not-allowed' : 'pointer',
      fontFamily: S.font, fontSize: 11, fontWeight: 700, transition: 'all 0.2s', marginRight: 4, marginBottom: 4
    }}>{busy ? '⟳' : label}</button>
  )

  const inp = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, color: S.text, padding: '10px 14px', fontFamily: S.font, fontSize: 12, outline: 'none', marginBottom: 10, boxSizing: 'border-box' as const }} />
  )

  const ta = (value: string, onChange: (v: string) => void, placeholder: string, rows = 3) => (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: '100%', background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, color: S.text, padding: '10px 14px', fontFamily: S.font, fontSize: 11, outline: 'none', resize: 'vertical' as const, marginBottom: 10, boxSizing: 'border-box' as const }} />
  )

  const card = (title: string, children: React.ReactNode) => (
    <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 12, padding: 18, marginBottom: 14 }}>
      <div style={{ color: S.dim, fontSize: 10, letterSpacing: 2, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )

  const categories = Array.from(new Set(ALL_PLATFORMS.map(p => p.category)))

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: S.font, fontSize: 13 }}>
      <header style={{ background: 'rgba(5,5,20,0.95)', borderBottom: '1px solid ' + S.border, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <img src="/api/image?type=logo" alt="FireNice" style={{ height: 34 }} />
        <div style={{ color: S.accent, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>ADMIN</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <a href="/" style={{ color: S.dim, textDecoration: 'none', fontSize: 11 }}>Dashboard</a>
          <a href="/store" style={{ color: S.green, textDecoration: 'none', fontSize: 11 }}>Store</a>
          <a href="/campaigns" style={{ color: S.yellow, textDecoration: 'none', fontSize: 11 }}>Post Now</a>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 57px)' }}>
        <nav style={{ width: 150, background: 'rgba(5,5,20,0.9)', borderRight: '1px solid ' + S.border, padding: '14px 8px', flexShrink: 0 }}>
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)} style={{
              width: '100%', background: section === s ? S.glow + '22' : 'none',
              border: section === s ? '1px solid ' + S.glow + '44' : '1px solid transparent',
              borderRadius: 8, color: section === s ? S.glow : S.dim,
              padding: '8px 10px', cursor: 'pointer', fontFamily: S.font, fontSize: 10,
              textAlign: 'left', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1
            }}>
              {s === 'dashboard' ? '◈ Dashboard' : s === 'products' ? '⚡ Products' : s === 'ideas' ? '💡 Ideas' : s === 'crypto' ? '₿ Crypto' : s === 'platforms' ? '🌐 Platforms' : s === 'legal' ? '⚖ Legal' : s === 'ai-config' ? '🤖 AI' : s === 'marketing' ? '📢 Marketing' : '⚙ Settings'}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>

          {section === 'dashboard' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 16px', fontSize: 16 }}>Dashboard</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Revenue', value: status?.transactions?.totalRevenueDollars || '$0.00', color: S.green },
                  { label: 'Products', value: String(status?.products?.length || 0), color: S.glow },
                  { label: 'Sales', value: String(status?.transactions?.count || 0), color: S.accent },
                  { label: 'Listed', value: String(status?.activeProducts || 0), color: S.yellow }
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                    <div style={{ color, fontSize: 20, fontWeight: 900 }}>{value}</div>
                    <div style={{ color: S.dim, fontSize: 9, marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>

              {card('QUICK ACTIONS', (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const }}>
                  {btn('🚀 Full Cycle', () => apiCall('full-cycle'), S.green)}
                  {btn('📦 Deliver', () => apiCall('deliver'), S.glow)}
                  {btn('📊 Analyze', () => apiCall('analyze'), S.yellow)}
                  {btn('◈ NFT', () => apiCall('nft'), '#ff44aa')}
                  {btn('₿ Crypto', () => apiCall('crypto'), '#f7931a')}
                  {btn('🔎 Diagnose', () => apiCall('diagnose'), S.accent)}
                  {btn('🖼 Regen Images', () => fetch('/api/regenerate-images?secret=' + (process.env.NEXT_PUBLIC_CRON_SECRET || 'firnice2024')).then(r => r.json()).then(d => setMsg(JSON.stringify(d))), S.accent)}
                  {btn('📢 Market', () => apiCall('marketing'), S.yellow)}
                  {btn('🔄 Sync', () => apiCall('sync'), S.dim)}
                </div>
              ))}

              {card('LEARNING PATH', (
                <div>
                  <div style={{ color: S.dim, fontSize: 11, marginBottom: 10 }}>Runs 3 cycles per cron. No timeout. Progress saved automatically.</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, marginBottom: 10 }}>
                    {btn('Start 100 Cycles', () => apiCall('learn-start-100'), S.green)}
                    {btn('Start 1000 Cycles', () => apiCall('learn-start-1000'), S.accent)}
                    {btn('Status', async () => { const r = await fetch('/api/orchestrate?action=learn-status'); const d = await r.json(); setMsg(d.status || 'No status') }, S.glow)}
                    {btn('Stop', () => apiCall('learn-stop'), S.red)}
                  </div>
                  {learningStatus && <pre style={{ background: '#0a0a20', padding: 10, borderRadius: 8, fontSize: 10, color: S.text, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{learningStatus}</pre>}
                </div>
              ))}

              {msg && card('OUTPUT', (
                <pre style={{ background: '#0a0a20', padding: 10, borderRadius: 8, fontSize: 10, whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: 250, color: S.text, margin: 0 }}>{msg}</pre>
              ))}
            </div>
          )}

          {section === 'platforms' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 8px', fontSize: 16 }}>Platform Authorization</h2>
              <p style={{ color: S.dim, fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
                Authorize Worker AI per platform. Toggle on to allow Worker to post, list, and interact. Paste API key when ready.
              </p>
              {categories.map(cat => (
                <div key={cat} style={{ marginBottom: 24 }}>
                  <div style={{ color: S.accent, fontSize: 10, letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>{cat}</div>
                  {ALL_PLATFORMS.filter(p => p.category === cat).map(platform => {
                    const currentLevel = platformAuths[platform.id]
                    const hasAccess = currentLevel && currentLevel !== 'blocked' && currentLevel !== 'none'
                    return (
                      <div key={platform.id} style={{ background: S.card, border: '1px solid ' + (hasAccess ? S.green + '44' : S.border), borderRadius: 10, padding: 14, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{platform.icon}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>{platform.name} {platform.freeSetup && <span style={{ color: S.green, fontSize: 9 }}>FREE</span>}</div>
                              <div style={{ color: S.dim, fontSize: 10 }}>{platform.desc}</div>
                            </div>
                          </div>
                          {currentLevel && (
                            <span style={{ background: hasAccess ? S.green + '22' : S.red + '22', border: '1px solid ' + (hasAccess ? S.green + '44' : S.red + '44'), borderRadius: 6, padding: '2px 8px', color: hasAccess ? S.green : S.red, fontSize: 9 }}>
                              {currentLevel.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, marginBottom: hasAccess ? 8 : 0 }}>
                          {!hasAccess ? (
                            <>
                              {btn('✓ Full', () => grantPlatformAccess(platform.id, 'full'), S.green)}
                              {btn('⊘ Limited', () => grantPlatformAccess(platform.id, 'limited'), S.yellow)}
                              {btn('👁 Read', () => grantPlatformAccess(platform.id, 'readonly'), S.dim)}
                            </>
                          ) : (
                            <>
                              <a href={platform.signupUrl} target="_blank" rel="noreferrer" style={{ background: S.glow + '22', border: '1px solid ' + S.glow + '44', borderRadius: 8, color: S.glow, padding: '8px 12px', fontSize: 11, textDecoration: 'none', fontWeight: 700, marginRight: 4, marginBottom: 4, display: 'inline-block' }}>Create Account →</a>
                              <a href={platform.apiUrl} target="_blank" rel="noreferrer" style={{ background: S.accent + '22', border: '1px solid ' + S.accent + '44', borderRadius: 8, color: S.accent, padding: '8px 12px', fontSize: 11, textDecoration: 'none', fontWeight: 700, marginRight: 4, marginBottom: 4, display: 'inline-block' }}>Get API Key →</a>
                              {btn('✗ Revoke', () => revokePlatformAccess(platform.id), S.red)}
                            </>
                          )}
                        </div>
                        {hasAccess && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              value={apiKeyInputs[platform.id] || ''}
                              onChange={e => setApiKeyInputs(prev => ({ ...prev, [platform.id]: e.target.value }))}
                              placeholder={'Paste ' + platform.keyName}
                              style={{ flex: 1, background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, color: S.text, padding: '8px 12px', fontFamily: S.font, fontSize: 11, outline: 'none' }}
                            />
                            <button onClick={() => saveApiKey(platform.id, platform.keyName)} disabled={!apiKeyInputs[platform.id]} style={{ background: S.green + '22', border: '1px solid ' + S.green + '44', borderRadius: 8, color: S.green, padding: '8px 14px', cursor: 'pointer', fontFamily: S.font, fontSize: 11, fontWeight: 700 }}>SAVE</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              {msg && <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 14, marginTop: 16 }}><pre style={{ fontSize: 11, color: S.text, margin: 0, whiteSpace: 'pre-wrap' }}>{msg}</pre></div>}
            </div>
          )}

          {section === 'ideas' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 16px', fontSize: 16 }}>Product Ideas</h2>
              {card('DIGITAL PRODUCT', (
                <div>
                  {inp(ideaForm.name, v => setIdeaForm(f => ({ ...f, name: v })), 'Product name')}
                  <select value={ideaForm.type} onChange={e => setIdeaForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%', background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, color: S.text, padding: '10px 14px', fontFamily: S.font, fontSize: 12, outline: 'none', marginBottom: 10 }}>
                    {['prompt-pack', 'ebook', 'template', 'guide', 'art-collection', 'service', 'digital'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {ta(ideaForm.description, v => setIdeaForm(f => ({ ...f, description: v })), 'What is this? What problem does it solve?')}
                  {inp(ideaForm.targetAudience, v => setIdeaForm(f => ({ ...f, targetAudience: v })), 'Target audience')}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ color: S.dim, fontSize: 11 }}>Price (cents):</span>
                    <input type="number" value={ideaForm.priceCents} onChange={e => setIdeaForm(f => ({ ...f, priceCents: parseInt(e.target.value) || 997 }))} style={{ width: 100, background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, color: S.text, padding: '8px', fontFamily: S.font, fontSize: 12, outline: 'none' }} />
                    <span style={{ color: S.green }}>${(ideaForm.priceCents / 100).toFixed(2)}</span>
                  </div>
                  {btn('⚡ CREATE PRODUCT', async () => {
                    setBusy(true); setMsg('Creating...')
                    try {
                      const r = await fetch('/api/orchestrate?action=product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ideaForm) })
                      setMsg(JSON.stringify(await r.json(), null, 2).slice(0, 500))
                    } catch (e: any) { setMsg('Error: ' + e.message) }
                    setBusy(false)
                  }, S.green)}
                </div>
              ))}
              {card('NFT IDEA', (
                <div>
                  {ta(ideaForm.nftConcept, v => setIdeaForm(f => ({ ...f, nftConcept: v })), 'Describe NFT: colors, shapes, mood, theme, style...', 4)}
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const }}>
                    {btn('◈ Create This NFT', async () => {
                      setBusy(true); setMsg('Creating...')
                      try {
                        const url = '/api/orchestrate?action=nft' + (ideaForm.nftConcept ? '&concept=' + encodeURIComponent(ideaForm.nftConcept) : '')
                        setMsg(JSON.stringify(await (await fetch(url)).json(), null, 2).slice(0, 500))
                      } catch (e: any) { setMsg('Error: ' + e.message) }
                      setBusy(false)
                    }, '#ff44aa')}
                    {btn('◈ Random NFT', () => apiCall('nft'), S.dim)}
                    {btn('Generate 5', async () => {
                      setBusy(true)
                      for (let i = 0; i < 5; i++) { try { await fetch('/api/orchestrate?action=nft'); setMsg('Generated ' + (i + 1) + '/5') } catch {} }
                      setMsg('5 NFTs created')
                      setBusy(false)
                    }, '#ff44aa')}
                  </div>
                </div>
              ))}
              {msg && <pre style={{ background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, padding: 12, fontSize: 10, whiteSpace: 'pre-wrap', color: S.text, maxHeight: 200, overflowY: 'auto' }}>{msg}</pre>}
            </div>
          )}

          {section === 'crypto' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 16px', fontSize: 16 }}>Crypto</h2>
              {card('CREATE CAMPAIGN', (
                <div>
                  {inp(cryptoForm.tokenName, v => setCryptoForm(f => ({ ...f, tokenName: v })), 'Token name (e.g. MoonShadow)')}
                  {inp(cryptoForm.ticker, v => setCryptoForm(f => ({ ...f, ticker: v })), 'Ticker (e.g. MOON)')}
                  {ta(cryptoForm.concept, v => setCryptoForm(f => ({ ...f, concept: v })), 'What is this token for?', 3)}
                  {btn('₿ GENERATE PACKAGE', async () => {
                    setBusy(true); setMsg('Generating...')
                    const concept = [cryptoForm.concept, cryptoForm.tokenName ? 'Name: ' + cryptoForm.tokenName : '', cryptoForm.ticker ? 'Ticker: ' + cryptoForm.ticker : ''].filter(Boolean).join('. ')
                    try { setMsg(JSON.stringify(await (await fetch('/api/orchestrate?action=crypto&concept=' + encodeURIComponent(concept))).json(), null, 2).slice(0, 600)) }
                    catch (e: any) { setMsg('Error: ' + e.message) }
                    setBusy(false)
                  }, '#f7931a')}
                </div>
              ))}
              {card('MOONSHADOW LAUNCH', (
                <div>
                  {[
                    ['1', 'Generate package', 'Use form above with MoonShadow AI utility token concept', S.green],
                    ['2', 'Get Phantom wallet', 'phantom.app — install and create wallet', S.green],
                    ['3', 'Buy $10 SOL', 'Coinbase → buy SOL → send to Phantom', S.yellow],
                    ['4', 'Deploy pump.fun', 'pump.fun → Create coin → ~$3 SOL', '#f7931a'],
                    ['5', 'Create Telegram', 't.me → Create group "MoonShadow Official"', S.accent],
                    ['6', 'Share contract', 'Post on Reddit r/CryptoMoonShots', S.glow]
                  ].map(([num, title, desc, color]) => (
                    <div key={num} style={{ display: 'flex', gap: 10, marginBottom: 8, padding: '8px 10px', background: '#0a0a20', borderRadius: 8 }}>
                      <span style={{ color: color as string, fontWeight: 700, minWidth: 18 }}>{num}</span>
                      <div><div style={{ color: S.text, fontWeight: 700, fontSize: 12 }}>{title}</div><div style={{ color: S.dim, fontSize: 10 }}>{desc}</div></div>
                    </div>
                  ))}
                </div>
              ))}
              {msg && <pre style={{ background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, padding: 10, fontSize: 10, whiteSpace: 'pre-wrap', color: S.text }}>{msg}</pre>}
            </div>
          )}

          {section === 'products' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 16px', fontSize: 16 }}>Products</h2>
              {card('BULK', (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const }}>
                  {btn('🖼 Regen Images', async () => { setBusy(true); const r = await fetch('/api/regenerate-images'); setMsg(JSON.stringify(await r.json())); setBusy(false) }, S.accent)}
                  {btn('📦 List Unlisted', () => apiCall('list'), S.glow)}
                  {btn('🌐 Push Markets', () => apiCall('list-all'), S.green)}
                  {btn('📦 Deliver All', () => apiCall('deliver'), S.yellow)}
                </div>
              ))}
              {card('PRODUCTS (' + (status?.products?.length || 0) + ')', (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {(status?.products || []).slice(0, 30).map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(100,120,255,0.05)', fontSize: 11 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <img src={'/api/image?id=' + p.id} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                        <div>
                          <div style={{ color: S.text }}>{p.name?.slice(0, 32)}</div>
                          <div style={{ color: S.dim, fontSize: 9 }}>{p.type} · {p.sales_count || 0} sales</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: S.green }}>${((p.price_cents || 0) / 100).toFixed(2)}</span>
                        <span style={{ color: p.gumroad_url ? S.green : S.red }}>{p.gumroad_url ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {msg && <pre style={{ background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, padding: 10, fontSize: 10, whiteSpace: 'pre-wrap', color: S.text }}>{msg}</pre>}
            </div>
          )}

          {section === 'legal' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 16px', fontSize: 16 }}>Legal &amp; Identity</h2>
              {card('BUSINESS INFO', (
                <div>
                  {inp(legalForm.businessName, v => setLegalForm(f => ({ ...f, businessName: v })), 'Business name')}
                  {inp(legalForm.tagline, v => setLegalForm(f => ({ ...f, tagline: v })), 'Tagline')}
                  {inp(legalForm.email, v => setLegalForm(f => ({ ...f, email: v })), 'Contact email')}
                  {ta(legalForm.refundPolicy, v => setLegalForm(f => ({ ...f, refundPolicy: v })), 'Refund policy', 2)}
                  {ta(legalForm.privacyPolicy, v => setLegalForm(f => ({ ...f, privacyPolicy: v })), 'Privacy policy', 4)}
                  {ta(legalForm.termsOfService, v => setLegalForm(f => ({ ...f, termsOfService: v })), 'Terms of service', 4)}
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const }}>
                    {btn('💾 Save', () => setMsg('Business info saved locally. Add to system_state via API if needed.'), S.glow)}
                    {btn('🤖 AI Generate', async () => {
                      setBusy(true)
                      setMsg('Generating policies...')
                      try {
                        const [privRes, termsRes] = await Promise.all([
                          fetch('/api/generate-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'privacy', businessName: legalForm.businessName }) }),
                          fetch('/api/generate-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'terms', businessName: legalForm.businessName }) })
                        ])
                        const privData = await privRes.json()
                        const termsData = await termsRes.json()
                        setLegalForm(f => ({ ...f, privacyPolicy: privData.result || 'Generation failed', termsOfService: termsData.result || 'Generation failed' }))
                        setMsg('Policies generated. Review above and save.')
                      } catch (e: any) { setMsg('Error: ' + e.message) }
                      setBusy(false)
                    }, S.accent)}
                  </div>
                </div>
              ))}
              {msg && <pre style={{ background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, padding: 10, fontSize: 10, whiteSpace: 'pre-wrap', color: S.text }}>{msg}</pre>}
            </div>
          )}

          {section === 'ai-config' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 16px', fontSize: 16 }}>AI Configuration</h2>
              {card('PROVIDERS', (
                <div>
                  {[
                    { name: 'OpenAI GPT-4o', key: 'OPENAI_API_KEY', url: 'platform.openai.com', desc: 'Text + DALL-E images' },
                    { name: 'Anthropic Claude', key: 'ANTHROPIC_API_KEY', url: 'console.anthropic.com', desc: 'Fallback text generation' },
                    { name: 'Replicate', key: 'REPLICATE_API_TOKEN', url: 'replicate.com/account', desc: 'Music, video, uncensored images' },
                    { name: 'Stability AI', key: 'STABILITY_API_KEY', url: 'platform.stability.ai', desc: 'High quality images' }
                  ].map(({ name, key, url, desc }) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(100,120,255,0.05)' }}>
                      <div>
                        <div style={{ color: S.text, fontWeight: 700, fontSize: 12 }}>{name}</div>
                        <div style={{ color: S.dim, fontSize: 10 }}>{desc} · {key}</div>
                      </div>
                      <a href={'https://' + url} target="_blank" rel="noreferrer" style={{ color: S.glow, fontSize: 10, textDecoration: 'none', background: S.glow + '22', border: '1px solid ' + S.glow + '44', borderRadius: 6, padding: '4px 8px' }}>Get →</a>
                    </div>
                  ))}
                </div>
              ))}
              {card('ADD VIA CREATOR AI', (
                <pre style={{ background: '#0a0a20', padding: 12, borderRadius: 8, fontSize: 10, color: S.green }}>
{`set env
REPLICATE_API_TOKEN=r8_your_token
STABILITY_API_KEY=sk_your_key
SENDGRID_API_KEY=SG.your_key
FROM_EMAIL=your@email.com`}
                </pre>
              ))}
            </div>
          )}

          {section === 'marketing' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 16px', fontSize: 16 }}>Marketing</h2>
              {card('ONE-TAP POSTING', (
                <div>
                  <div style={{ color: S.dim, fontSize: 11, marginBottom: 10 }}>The Campaigns page has pre-filled share links — tap any to open and post.</div>
                  <a href="/campaigns" target="_blank" style={{ display: 'inline-block', background: S.yellow + '22', border: '1px solid ' + S.yellow + '44', borderRadius: 8, color: S.yellow, padding: '10px 16px', fontSize: 12, textDecoration: 'none', fontWeight: 700 }}>📢 CAMPAIGNS PAGE →</a>
                </div>
              ))}
              {card('ACTIONS', (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const }}>
                  {btn('Run Marketing', () => apiCall('marketing'), S.yellow)}
                  {btn('SEO Content', () => apiCall('seo'), S.green)}
                  {btn('Directories', () => apiCall('directories'), S.glow)}
                  {btn('Media Assets', () => apiCall('media'), '#ff44aa')}
                </div>
              ))}
              {msg && <pre style={{ background: '#0a0a20', border: '1px solid ' + S.border, borderRadius: 8, padding: 10, fontSize: 10, whiteSpace: 'pre-wrap', color: S.text }}>{msg}</pre>}
            </div>
          )}

          {section === 'settings' && (
            <div>
              <h2 style={{ color: S.text, margin: '0 0 16px', fontSize: 16 }}>Settings</h2>
              {card('SYSTEM STATE', (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {Object.entries(status?.state || {}).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(100,120,255,0.04)', fontSize: 11 }}>
                      <span style={{ color: S.dim }}>{k}</span>
                      <span style={{ color: S.text }}>{String(v).slice(0, 35)}</span>
                    </div>
                  ))}
                </div>
              ))}
              {card('AUTONOMY', (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const }}>
                  {btn('Level 1 Manual', () => apiCall('set-level', { level: '1' }), S.green)}
                  {btn('Level 2 Semi', () => apiCall('set-level', { level: '2' }), S.yellow)}
                  {btn('Level 3 Full Auto', () => apiCall('set-level', { level: '3' }), S.red)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
