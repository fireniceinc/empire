import { useState, useEffect, useRef } from 'react'

const S = {
  bg: '#050510', card: 'rgba(10,12,40,0.92)', border: 'rgba(100,120,255,0.2)',
  glow: '#4466ff', green: '#00ffaa', text: '#d0d8ff', dim: '#4455aa',
  accent: '#aa66ff', red: '#ff4466', yellow: '#ffaa00', font: 'ui-monospace, monospace'
}

interface ChatMsg { role: 'user' | 'system'; content: string; image?: string }

function Particles() {
  const items = Array.from({ length: 30 }, (_, i) => ({
    l: ((i * 37 + 13) % 100) + '%', t: ((i * 53 + 7) % 100) + '%',
    s: (i % 3) + 1, h: 210 + (i % 70)
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {items.map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: p.l, top: p.t, width: p.s + 'px', height: p.s + 'px', borderRadius: i % 2 === 0 ? '50%' : '2px', background: 'hsl(' + p.h + ',100%,70%)', boxShadow: '0 0 ' + (p.s * 3) + 'px hsl(' + p.h + ',100%,70%)', opacity: 0.25 }} />
      ))}
      <style>{`* { box-sizing: border-box; }`}</style>
    </div>
  )
}

const TYPE_COLORS: Record<string, string> = {
  'nft': '#ff44aa', 'crypto': '#f7931a', 'prompt-pack': '#00ffaa', 'ebook': '#4466ff',
  'template': '#aa66ff', 'guide': '#ffaa00', 'art-collection': '#ff6644', 'digital': '#44aaff',
  'service': '#44ffff', 'music': '#ff77dd', 'video': '#f7931a'
}

const LEVEL_INFO: Record<string, { label: string; desc: string; color: string; actions: string[] }> = {
  '1': { label: 'Level 1', desc: 'Manual', color: S.green, actions: ['research', 'product', 'list', 'deliver'] },
  '2': { label: 'Level 2', desc: 'Semi-Auto', color: S.yellow, actions: ['research', 'product', 'list', 'list-all', 'marketing', 'seo', 'deliver', 'nft', 'sync', 'diagnose'] },
  '3': { label: 'Level 3', desc: 'Full Auto', color: S.red, actions: ['research', 'product', 'list', 'list-all', 'marketing', 'seo', 'deliver', 'nft', 'analyze', 'diagnose', 'sync', 'self-update', 'improve', 'full-cycle'] },
  '4': { label: 'Level 4', desc: 'Full Auto + Spend Gate', color: '#ff00aa', actions: ['research', 'product', 'list', 'list-all', 'marketing', 'seo', 'deliver', 'nft', 'crypto', 'music', 'video', 'analyze', 'diagnose', 'sync', 'self-update', 'improve', 'full-cycle', 'push-storefronts'] }
}

export default function WorkerDashboard() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([{ role: 'system', content: 'Worker AI — ask me anything about the business, or type a command.' }])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatImage, setChatImage] = useState<string | null>(null)
  const [approvalCount, setApprovalCount] = useState(0)
  const [dailyCap, setDailyCap] = useState('10')
  const chatBottom = useRef<HTMLDivElement>(null)
  const chatFileRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<any>(null)

  async function fetchStatus() {
    try {
      const r = await fetch('/api/status')
      if (r.ok) setStatus(await r.json())
    } catch {}
    finally { setLoading(false) }
  }

  async function fetchApprovals() {
    try {
      const r = await fetch('/api/orchestrate?action=approval-queue')
      const d = await r.json()
      setApprovalCount((d.queue || []).length)
    } catch {}
  }

  useEffect(() => {
    fetchStatus()
    fetchApprovals()
    intervalRef.current = setInterval(() => { fetchStatus(); fetchApprovals() }, 30000)
    return () => clearInterval(intervalRef.current)
  }, [])

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMsgs])

  async function runAction(action: string) {
    setActionLoading(action)
    setActionResult('Running ' + action + '...')
    try {
      const r = await fetch('/api/orchestrate?action=' + action)
      const d = await r.json()
      setActionResult(JSON.stringify(d, null, 2))
      await fetchStatus()
    } catch (e: any) { setActionResult('Error: ' + e.message) }
    setActionLoading(null)
  }

  async function setAutonomyLevel(level: string) {
    setActionLoading('level-' + level)
    try {
      const r = await fetch('/api/orchestrate?action=set-level&level=' + level)
      const d = await r.json()
      if (d.success) { setActionResult('Autonomy set to level ' + level); await fetchStatus() }
      else setActionResult('Error: ' + (d.error || 'unknown'))
    } catch (e: any) { setActionResult('Error: ' + e.message) }
    setActionLoading(null)
  }

  async function saveDailyCap() {
    setActionLoading('cap')
    try {
      await fetch('/api/orchestrate?action=set-daily-cap&dollars=' + dailyCap)
      setActionResult('Daily spend cap set to $' + dailyCap)
    } catch (e: any) { setActionResult('Error: ' + e.message) }
    setActionLoading(null)
  }

  function handleChatFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setChatImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatBusy) return
    setChatInput('')
    const userMsg: ChatMsg = { role: 'user', content: text }
    if (chatImage) userMsg.image = chatImage
    setChatMsgs(m => [...m, userMsg])
    setChatImage(null)
    setChatBusy(true)
    const lower = text.toLowerCase()

    try {
      if (lower === 'full cycle') {
        setChatMsgs(m => [...m, { role: 'system', content: 'Starting full cycle...' }])
        const r = await fetch('/api/orchestrate?action=full-cycle')
        const d = await r.json()
        setChatMsgs(m => [...m, { role: 'system', content: 'Done:\n' + JSON.stringify(d, null, 2).slice(0, 600) }])
        await fetchStatus()
      } else if (lower === 'status' || lower === 'report') {
        const r = await fetch('/api/orchestrate?action=report')
        const d = await r.json()
        setChatMsgs(m => [...m, { role: 'system', content: d.report || JSON.stringify(d).slice(0, 600) }])
      } else if (lower === 'diagnose') {
        const r = await fetch('/api/orchestrate?action=diagnose')
        const d = await r.json()
        setChatMsgs(m => [...m, { role: 'system', content: d.report || JSON.stringify(d).slice(0, 800) }])
      } else if (lower === 'health') {
        const r = await fetch('/api/health')
        const d = await r.json()
        setChatMsgs(m => [...m, { role: 'system', content: JSON.stringify(d, null, 2).slice(0, 800) }])
      } else {
        const r = await fetch('/api/orchestrate?action=chat&message=' + encodeURIComponent(text))
        const d = await r.json()
        setChatMsgs(m => [...m, { role: 'system', content: d.reply || 'No response' }])
      }
    } catch (e: any) {
      setChatMsgs(m => [...m, { role: 'system', content: 'Error: ' + e.message }])
    }
    setChatBusy(false)
  }

  const s = status || {}
  const products = s.products || []
  const listedProducts = products.filter((p: any) => p.gumroad_url)
  const agentLogs = s.agentLogs || []
  const revenue = s.total_revenue_cents ? '$' + (parseInt(s.total_revenue_cents) / 100).toFixed(2) : '$0.00'
  const txCount = s.state?.total_revenue_cents ? '' : ''
  const currentLevel = s.state?.autonomy_level || '1'
  const lastCycle = s.state?.last_cycle ? new Date(s.state.last_cycle).toLocaleTimeString() : 'Never'
  const businessCycle = s.state?.business_cycle || 'idle'
  const connectivityError = s.connectivity_error

  const agentColors: Record<string, string> = {
    research: S.green, product: S.glow, storefront: S.accent, marketing: S.yellow,
    accounting: '#44aaff', nft: '#ff44aa', delivery: '#aaffaa', analytics: '#ffaaff',
    marketplace: '#44ffff', crypto: '#f7931a', learning: '#ffaa44', ai_provider: '#88ffcc'
  }

  const tabs = ['overview', 'products', 'activity', 'marketing', 'settings']
  const allActions: Record<string, { label: string; color: string }> = {
    research: { label: '🔍 Research', color: S.green },
    product: { label: '⚡ Product', color: S.glow },
    list: { label: '🏪 List', color: S.accent },
    'list-all': { label: '🌐 List All', color: '#aa44ff' },
    marketing: { label: '📢 Market', color: S.yellow },
    seo: { label: '🔎 SEO', color: '#44ffaa' },
    deliver: { label: '📦 Deliver', color: '#aaffaa' },
    nft: { label: '◈ NFT', color: '#ff44aa' },
    crypto: { label: '₿ Crypto', color: '#f7931a' },
    music: { label: '♪ Music', color: '#ff77dd' },
    video: { label: '▶ Video', color: '#f7931a' },
    analyze: { label: '📊 Analyze', color: '#ffaaff' },
    diagnose: { label: '🔬 Diagnose', color: S.accent },
    sync: { label: '🔄 Sync', color: S.dim },
    improve: { label: '🧠 Improve', color: '#88ffcc' },
    'self-update': { label: '🔧 Self-Update', color: '#ffcc88' },
    'push-storefronts': { label: '🏬 Push Info', color: '#44aaff' },
    'full-cycle': { label: '🚀 FULL CYCLE', color: S.green }
  }
  const visibleActions = LEVEL_INFO[currentLevel]?.actions || LEVEL_INFO['1'].actions

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: S.font, fontSize: 13 }}>
      <Particles />
      <div style={{ position: 'relative', zIndex: 1 }}>

        <header style={{ background: 'rgba(5,5,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid ' + S.border, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap' as const }}>
          <img src="/api/image?type=logo" alt="FireNice" style={{ height: 36 }} />
          <div>
            <div style={{ color: S.text, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>WORKER AI</div>
            <div style={{ color: S.dim, fontSize: 9, letterSpacing: 3 }}>AUTONOMOUS BUSINESS ENGINE</div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexWrap: 'wrap' as const }}>
            <span style={{ background: (connectivityError ? S.red : S.green) + '22', border: '1px solid ' + (connectivityError ? S.red : S.green) + '44', borderRadius: 6, padding: '2px 8px', color: connectivityError ? S.red : S.green, fontSize: 9 }}>
              {connectivityError ? '● DB ISSUE' : '● LIVE'}
            </span>
            <span style={{ background: LEVEL_INFO[currentLevel].color + '22', border: '1px solid ' + LEVEL_INFO[currentLevel].color + '44', borderRadius: 6, padding: '2px 8px', color: LEVEL_INFO[currentLevel].color, fontSize: 9 }}>
              L{currentLevel} {LEVEL_INFO[currentLevel].desc.toUpperCase()}
            </span>
            {currentLevel === '4' && approvalCount > 0 && (
              <a href="/approvals" style={{ background: S.red + '33', border: '1px solid ' + S.red + '66', borderRadius: 6, padding: '2px 8px', color: S.red, fontSize: 9, textDecoration: 'none', fontWeight: 700 }}>
                ⚠ {approvalCount} WAITING ON YOU
              </a>
            )}
            {businessCycle !== 'idle' && (
              <span style={{ background: S.yellow + '22', border: '1px solid ' + S.yellow + '44', borderRadius: 6, padding: '2px 8px', color: S.yellow, fontSize: 9 }}>⟳ {businessCycle.toUpperCase()}</span>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
            <span style={{ color: S.dim, fontSize: 10 }}>Last: {lastCycle}</span>
            <button onClick={() => setChatOpen(!chatOpen)} style={{ background: chatOpen ? S.accent + '33' : S.card, border: '1px solid ' + (chatOpen ? S.accent : S.border), borderRadius: 8, color: chatOpen ? S.accent : S.dim, padding: '5px 12px', cursor: 'pointer', fontFamily: S.font, fontSize: 10 }}>💬 CHAT</button>
            <a href="/store" target="_blank" rel="noreferrer" style={{ background: S.accent + '22', border: '1px solid ' + S.accent + '44', borderRadius: 8, color: S.accent, padding: '5px 10px', fontSize: 10, textDecoration: 'none' }}>STORE →</a>
            <a href="/admin" style={{ background: S.glow + '22', border: '1px solid ' + S.glow + '44', borderRadius: 8, color: S.glow, padding: '5px 10px', fontSize: 10, textDecoration: 'none' }}>ADMIN</a>
            <a href="/campaigns" style={{ background: S.yellow + '22', border: '1px solid ' + S.yellow + '44', borderRadius: 8, color: S.yellow, padding: '5px 10px', fontSize: 10, textDecoration: 'none' }}>POST</a>
            <button onClick={fetchStatus} style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 8, color: S.text, padding: '5px 10px', cursor: 'pointer', fontFamily: S.font, fontSize: 11 }}>↻</button>
          </div>
        </header>

        {connectivityError && (
          <div style={{ background: S.red + '15', borderBottom: '1px solid ' + S.red + '33', padding: '8px 20px', color: S.red, fontSize: 11 }}>
            ⚠ {connectivityError}
          </div>
        )}

        <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'REVENUE', value: revenue, color: S.green },
                { label: 'PRODUCTS', value: String(listedProducts.length), color: S.glow },
                { label: 'TOTAL PRODUCTS', value: String(products.length), color: S.accent },
                { label: 'CAMPAIGNS', value: String((s.marketing?.recent || []).length), color: S.yellow }
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ color, fontSize: 20, fontWeight: 900, textShadow: '0 0 12px ' + color }}>{value}</div>
                  <div style={{ color: S.dim, fontSize: 9, marginTop: 4, letterSpacing: 1 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 10 }}>AUTONOMY LEVEL</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {(['1', '2', '3', '4'] as const).map(level => {
                  const info = LEVEL_INFO[level]
                  return (
                    <button key={level} onClick={() => setAutonomyLevel(level)} disabled={actionLoading !== null} style={{
                      flex: '1 1 100px', background: currentLevel === level ? info.color + '33' : S.card,
                      border: '2px solid ' + (currentLevel === level ? info.color : S.border),
                      borderRadius: 8, color: currentLevel === level ? info.color : S.dim,
                      padding: '10px 4px', cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                      fontFamily: S.font, fontSize: 10, fontWeight: currentLevel === level ? 700 : 400,
                      boxShadow: currentLevel === level ? '0 0 14px ' + info.color + '44' : 'none', transition: 'all 0.2s'
                    }}>
                      <div>{info.label}</div>
                      <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{info.desc}</div>
                    </button>
                  )
                })}
              </div>
              {currentLevel === '4' && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid ' + S.border, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <span style={{ color: S.dim, fontSize: 11 }}>Daily spend cap ($):</span>
                  <input value={dailyCap} onChange={e => setDailyCap(e.target.value)} style={{ width: 70, background: S.bg, border: '1px solid ' + S.border, borderRadius: 6, color: S.text, padding: '5px 8px', fontFamily: S.font, fontSize: 12 }} />
                  <button onClick={saveDailyCap} style={{ background: '#ff00aa22', border: '1px solid #ff00aa44', borderRadius: 6, color: '#ff00aa', padding: '5px 12px', cursor: 'pointer', fontFamily: S.font, fontSize: 11 }}>Set Cap</button>
                  <a href="/approvals" style={{ marginLeft: 'auto', color: S.red, fontSize: 11, textDecoration: 'none' }}>View approval queue →</a>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
              {tabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: activeTab === tab ? S.glow + '22' : S.card, border: '1px solid ' + (activeTab === tab ? S.glow : S.border), borderRadius: 8, color: activeTab === tab ? S.glow : S.dim, padding: '7px 14px', cursor: 'pointer', fontFamily: S.font, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' as const }}>{tab}</button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 16 }}>
                  <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>QUICK ACTIONS — LEVEL {currentLevel} UNLOCKED</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                    {visibleActions.map(action => {
                      const cfg = allActions[action]
                      if (!cfg) return null
                      return (
                        <button key={action} onClick={() => runAction(action)} disabled={actionLoading !== null} style={{
                          background: actionLoading === action ? cfg.color + '11' : cfg.color + '22',
                          border: '1px solid ' + cfg.color + '44', borderRadius: 7, color: actionLoading === action ? S.dim : cfg.color,
                          padding: '9px 6px', cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                          fontFamily: S.font, fontSize: 10, fontWeight: action === 'full-cycle' ? 700 : 400,
                          transition: 'all 0.2s', gridColumn: action === 'full-cycle' ? 'span 2' : undefined
                        }}>{actionLoading === action ? '⟳' : cfg.label}</button>
                      )
                    })}
                  </div>
                  {actionResult && <pre style={{ background: S.bg, border: '1px solid ' + S.border, borderRadius: 8, padding: 10, color: S.text, fontSize: 9, overflowX: 'auto', whiteSpace: 'pre-wrap' as const, maxHeight: 180, overflowY: 'auto', margin: 0 }}>{actionResult}</pre>}
                </div>

                <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 16 }}>
                  <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>RECENT ACTIVITY</div>
                  {agentLogs.length === 0 ? <div style={{ color: S.dim, fontSize: 11 }}>No activity yet.</div> :
                    agentLogs.slice(0, 14).map((log: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', borderBottom: i < 13 ? '1px solid rgba(100,120,255,0.04)' : 'none' }}>
                        <span style={{ color: S.dim, fontSize: 9, minWidth: 60 }}>{log.created_at ? new Date(log.created_at).toLocaleTimeString() : '--'}</span>
                        <span style={{ color: agentColors[log.agent_name] || S.glow, fontSize: 9, minWidth: 80 }}>{log.agent_name}</span>
                        <span style={{ color: S.text, fontSize: 9, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{log.action}</span>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: log.status === 'error' ? S.red : S.green, flexShrink: 0 }} />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div>
                <div style={{ color: S.dim, fontSize: 10, marginBottom: 12 }}>{products.length} total · {listedProducts.length} listed</div>
                {products.length === 0 ? <div style={{ textAlign: 'center', color: S.dim, padding: 40 }}>No products yet. Run Product or Full Cycle.</div> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {products.map((p: any) => (
                      <div key={p.id} style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ position: 'relative', paddingTop: '55%', background: '#0a0a20' }}>
                          <img src={'/api/image?id=' + p.id} alt={p.name} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' as const }} />
                          <div style={{ position: 'absolute', top: 8, left: 8, background: (TYPE_COLORS[p.type] || S.glow) + '33', border: '1px solid ' + (TYPE_COLORS[p.type] || S.glow) + '66', borderRadius: 5, padding: '1px 6px', fontSize: 9, color: TYPE_COLORS[p.type] || S.glow }}>{p.type}</div>
                          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.75)', borderRadius: 5, padding: '1px 8px', fontSize: 13, color: S.green, fontWeight: 900 }}>${((p.price_cents || 0) / 100).toFixed(2)}</div>
                        </div>
                        <div style={{ padding: 12 }}>
                          <div style={{ color: S.text, fontWeight: 700, marginBottom: 4, fontSize: 12 }}>{p.name}</div>
                          <div style={{ color: S.dim, fontSize: 10, marginBottom: 8 }}>{p.sales_count || 0} sales · {p.art_status || 'pending'}</div>
                          {p.gumroad_url ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <a href={p.gumroad_url} target="_blank" rel="noreferrer" style={{ flex: 1, background: S.green + '22', border: '1px solid ' + S.green + '44', borderRadius: 6, color: S.green, padding: '6px 8px', fontSize: 10, textDecoration: 'none', textAlign: 'center' as const }}>BUY</a>
                              <a href={'/product/' + p.id} target="_blank" rel="noreferrer" style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 6, color: S.dim, padding: '6px 10px', fontSize: 10, textDecoration: 'none' }}>👁</a>
                            </div>
                          ) : <button onClick={() => runAction('list')} style={{ width: '100%', background: S.accent + '22', border: '1px solid ' + S.accent + '44', borderRadius: 6, color: S.accent, padding: '6px', fontSize: 10, cursor: 'pointer', fontFamily: S.font }}>LIST NOW →</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 16 }}>
                <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>FULL ACTIVITY LOG</div>
                {agentLogs.map((log: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(100,120,255,0.04)' }}>
                    <span style={{ color: S.dim, fontSize: 9, minWidth: 70 }}>{log.created_at ? new Date(log.created_at).toLocaleTimeString() : '--'}</span>
                    <span style={{ color: agentColors[log.agent_name] || S.glow, fontSize: 10, minWidth: 90, fontWeight: 700 }}>{log.agent_name}</span>
                    <span style={{ color: S.text, fontSize: 10, flex: 1 }}>{log.action}</span>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: log.status === 'error' ? S.red : S.green, flexShrink: 0, alignSelf: 'center' }} />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'marketing' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 16 }}>
                  <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>CAMPAIGNS</div>
                  {(s.marketing?.recent || []).length === 0 ? <div style={{ color: S.dim, fontSize: 11 }}>No campaigns yet.</div> :
                    (s.marketing?.recent || []).map((c: any, i: number) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(100,120,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: S.accent, fontWeight: 700, fontSize: 11 }}>{c.platform}</span>
                          <span style={{ color: c.status === 'posted' ? S.green : S.yellow, fontSize: 10 }}>{c.status}</span>
                        </div>
                      </div>
                    ))}
                </div>
                <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 16 }}>
                  <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>QUICK LINKS</div>
                  {[
                    { label: '📢 Post Now', href: '/campaigns', color: S.yellow },
                    { label: '◈ NFT Gallery', href: '/gallery', color: '#ff44aa' },
                    { label: '🏪 Public Store', href: '/store', color: S.green },
                    { label: '⚙ Admin Panel', href: '/admin', color: S.accent },
                    { label: '⚠ Approval Queue', href: '/approvals', color: S.red }
                  ].map(({ label, href, color }) => (
                    <a key={href} href={href} target="_blank" rel="noreferrer" style={{ display: 'block', background: color + '11', border: '1px solid ' + color + '33', borderRadius: 6, color, padding: '8px 12px', fontSize: 11, textDecoration: 'none', marginBottom: 6 }}>{label}</a>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 16 }}>
                  <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>SYSTEM STATE</div>
                  {Object.entries(s.state || {}).map(([key, val]: [string, any]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(100,120,255,0.04)', fontSize: 11 }}>
                      <span style={{ color: S.dim }}>{key}</span>
                      <span style={{ color: S.text }}>{String(val).slice(0, 28)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 10, padding: 16 }}>
                  <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>DIAGNOSTICS</div>
                  {[
                    { label: 'Health Check', href: '/api/health', color: S.glow },
                    { label: 'Database Ping', href: '/api/db-ping', color: S.green },
                    { label: 'AI Provider Test', href: '/api/ai-test', color: '#ffaaff' },
                    { label: 'Env Check', href: '/api/env-check', color: S.yellow }
                  ].map(({ label, href, color }) => (
                    <a key={href} href={href} target="_blank" rel="noreferrer" style={{ display: 'block', background: color + '11', border: '1px solid ' + color + '33', borderRadius: 6, color, padding: '8px 12px', fontSize: 11, textDecoration: 'none', marginBottom: 6 }}>{label}</a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {chatOpen && (
            <div style={{ width: 320, background: S.card, borderLeft: '1px solid ' + S.border, display: 'flex', flexDirection: 'column' as const, zIndex: 2 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + S.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: S.accent, fontWeight: 700, fontSize: 12 }}>💬 WORKER CHAT</span>
                <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: S.dim, cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', background: m.role === 'user' ? S.glow + '22' : 'rgba(5,5,20,0.8)', border: '1px solid ' + (m.role === 'user' ? S.glow + '44' : S.border), borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px', padding: '8px 12px' }}>
                    {m.image && <img src={m.image} alt="attached" style={{ maxWidth: '100%', borderRadius: 6, marginBottom: 6, display: 'block' }} />}
                    <div style={{ color: m.role === 'user' ? '#b0c0ff' : S.text, fontSize: 11, whiteSpace: 'pre-wrap' as const, lineHeight: 1.6 }}>{m.content}</div>
                  </div>
                ))}
                {chatBusy && <div style={{ color: S.dim, fontSize: 11, alignSelf: 'flex-start' }}>⟳ Thinking...</div>}
                <div ref={chatBottom} />
              </div>
              <div style={{ padding: 10, borderTop: '1px solid ' + S.border }}>
                {chatImage && (
                  <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={chatImage} alt="preview" style={{ height: 36, borderRadius: 4, border: '1px solid ' + S.border }} />
                    <span style={{ color: S.green, fontSize: 9 }}>Image ready</span>
                    <button onClick={() => setChatImage(null)} style={{ background: 'none', border: 'none', color: S.dim, cursor: 'pointer', padding: 0 }}>×</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => chatFileRef.current?.click()} style={{ background: S.bg, border: '1px solid ' + S.border, borderRadius: 6, color: S.dim, padding: '6px 8px', cursor: 'pointer', fontSize: 12 }}>📎</button>
                  <input ref={chatFileRef} type="file" accept="image/*" onChange={handleChatFile} style={{ display: 'none' }} />
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }} placeholder="Ask or command..." style={{ flex: 1, background: S.bg, border: '1px solid ' + S.border, borderRadius: 6, color: S.text, padding: '6px 10px', fontFamily: S.font, fontSize: 11, outline: 'none' }} />
                  <button onClick={sendChat} disabled={chatBusy} style={{ background: chatBusy ? S.card : S.accent + '33', border: '1px solid ' + S.accent + '44', borderRadius: 6, color: S.accent, padding: '6px 10px', cursor: chatBusy ? 'not-allowed' : 'pointer', fontFamily: S.font, fontSize: 10, fontWeight: 700 }}>{chatBusy ? '...' : '↑'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
