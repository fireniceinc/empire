import { useState, useEffect } from 'react'

const S = {
  bg: '#050510', card: 'rgba(10,12,40,0.92)', border: 'rgba(100,120,255,0.2)',
  glow: '#4466ff', green: '#00ffaa', text: '#d0d8ff', dim: '#4455aa',
  accent: '#aa66ff', font: 'ui-monospace, monospace'
}

function Particles() {
  const items = Array.from({ length: 30 }, (_, i) => ({
    l: ((i * 37 + 13) % 100) + '%', t: ((i * 53 + 7) % 100) + '%',
    s: (i % 3) + 1, h: 210 + (i % 70), d: 2 + (i % 5)
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {items.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.l, top: p.t,
          width: p.s + 'px', height: p.s + 'px',
          borderRadius: i % 2 === 0 ? '50%' : '2px',
          background: 'hsl(' + p.h + ',100%,70%)',
          boxShadow: '0 0 ' + (p.s * 3) + 'px hsl(' + p.h + ',100%,70%)',
          opacity: 0.25
        }} />
      ))}
      <div style={{ position: 'absolute', top: '20%', left: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(68,102,255,0.07) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(170,102,255,0.07) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <style>{`* { box-sizing: border-box; }`}</style>
    </div>
  )
}

const TYPE_COLORS: Record<string, string> = {
  'nft': '#ff44aa', 'crypto': '#f7931a', 'prompt-pack': '#00ffaa',
  'ebook': '#4466ff', 'template': '#aa66ff', 'guide': '#ffaa00',
  'art-collection': '#ff6644', 'digital': '#44aaff', 'service': '#44ffff'
}

function ProductCard({ product, index }: { product: any; index: number }) {
  const [hover, setHover] = useState(false)
  const color = TYPE_COLORS[product.type] || S.glow
  const price = '$' + ((product.price_cents || 0) / 100).toFixed(2)
  const imageUrl = '/api/image?id=' + product.id

  const buyLabel = product.type === 'nft'
    ? '◈ MINT / BUY NFT'
    : product.type === 'crypto'
    ? '₿ GET CRYPTO KIT'
    : '→ GET IT NOW — ' + price

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(15,18,60,0.98)' : S.card,
        border: '1px solid ' + (hover ? color + '88' : S.border),
        borderRadius: 16, overflow: 'hidden',
        transition: 'all 0.3s ease',
        boxShadow: hover ? '0 0 30px ' + color + '33, 0 8px 40px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.3)',
        transform: hover ? 'translateY(-6px)' : 'none',
        display: 'flex', flexDirection: 'column'
      }}
    >
      <div style={{ position: 'relative', width: '100%', paddingTop: '58%', overflow: 'hidden', background: '#0a0a20' }}>
        <img
          src={imageUrl}
          alt={product.name}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', top: 10, left: 10, background: color + '33', border: '1px solid ' + color + '66', borderRadius: 6, padding: '2px 8px', fontSize: 9, color, letterSpacing: 1, backdropFilter: 'blur(4px)' }}>
          {product.type.toUpperCase()}
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.75)', border: '1px solid ' + S.green + '66', borderRadius: 6, padding: '2px 10px', fontSize: 15, color: S.green, fontWeight: 900, backdropFilter: 'blur(4px)' }}>
          {price}
        </div>
      </div>

      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ color: S.text, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{product.name}</div>
        <div style={{ color: S.dim, fontSize: 11, lineHeight: 1.6, flex: 1 }}>
          {(product.description || '').slice(0, 100)}{(product.description || '').length > 100 ? '...' : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: S.dim, fontSize: 10 }}>{product.sales_count || 0} sold</span>
          {product.type === 'nft' && <span style={{ color: '#ff44aa', fontSize: 9, letterSpacing: 1 }}>◈ UNIQUE NFT</span>}
        </div>

        {product.gumroad_url ? (
          <a href={product.gumroad_url} target="_blank" rel="noreferrer" style={{
            display: 'block', textAlign: 'center',
            background: 'linear-gradient(135deg, ' + color + '33, ' + color + '11)',
            border: '1px solid ' + color + '66', borderRadius: 10, color,
            padding: '11px', fontSize: 11, fontWeight: 700, textDecoration: 'none',
            letterSpacing: 1, transition: 'all 0.2s',
            boxShadow: hover ? '0 0 20px ' + color + '44' : 'none'
          }}>
            {buyLabel}
          </a>
        ) : (
          <div style={{ textAlign: 'center', background: S.dim + '11', border: '1px solid ' + S.border, borderRadius: 10, color: S.dim, padding: '11px', fontSize: 11 }}>
            Listing in progress...
          </div>
        )}
      </div>
    </div>
  )
}

export default function Store() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [section, setSection] = useState('all')

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const all = products
  const nfts = all.filter(p => p.type === 'nft')
  const crypto = all.filter(p => p.type === 'crypto')
  const digital = all.filter(p => p.type !== 'nft' && p.type !== 'crypto')
  const listedCount = all.filter(p => p.gumroad_url).length

  const visibleProducts = section === 'nft' ? nfts : section === 'crypto' ? crypto : digital

  const filtered = visibleProducts.filter(p => {
    const matchType = filter === 'all' || p.type === filter
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: S.font }}>
      <Particles />
      <div style={{ position: 'relative', zIndex: 1 }}>

        <header style={{ background: 'rgba(5,5,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid ' + S.border, padding: '14px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/api/image?type=logo" alt="FireNice" style={{ height: 40, width: 'auto' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, background: 'linear-gradient(135deg, #d0d8ff, #aa66ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FIRENIC</div>
              <div style={{ color: S.dim, fontSize: 9, letterSpacing: 4 }}>AI PRODUCTS</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'All', s: 'all' },
              { label: '◈ NFTs (' + nfts.length + ')', s: 'nft' },
              { label: '₿ Crypto (' + crypto.length + ')', s: 'crypto' },
              { label: 'Digital (' + digital.length + ')', s: 'digital' }
            ].map(item => (
              <button key={item.s} onClick={() => setSection(item.s)} style={{
                background: section === item.s ? S.glow + '22' : 'none',
                border: '1px solid ' + (section === item.s ? S.glow : 'transparent'),
                color: section === item.s ? S.glow : S.dim,
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: S.font, fontSize: 11
              }}>{item.label}</button>
            ))}
            <span style={{ background: S.green + '22', border: '1px solid ' + S.green + '44', borderRadius: 6, padding: '4px 10px', color: S.green, fontSize: 10 }}>
              {listedCount} live
            </span>
            <a href="/" style={{ color: S.dim, textDecoration: 'none', fontSize: 11, padding: '4px 8px' }}>Dashboard</a>
          </div>
        </header>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '50px 20px' }}>

          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ fontSize: 10, color: S.accent, letterSpacing: 4, marginBottom: 14 }}>FIRENIC AI MARKETPLACE</div>
            <h1 style={{ fontSize: 44, fontWeight: 900, margin: '0 0 16px', background: 'linear-gradient(135deg, #d0d8ff 0%, #aa66ff 50%, #4466ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
              AI-Generated<br />Digital Products
            </h1>
            <p style={{ color: S.dim, fontSize: 14, maxWidth: 460, margin: '0 auto', lineHeight: 1.8 }}>
              Every product autonomously created by AI. NFTs, crypto launch kits, prompt packs, templates and more. Instant delivery.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 8, color: S.text, padding: '9px 14px', fontSize: 13, fontFamily: S.font, outline: 'none', minWidth: 200 }} />
            {['all', ...Array.from(new Set(visibleProducts.map(p => p.type)))].map(t => (
              <button key={t} onClick={() => setFilter(t)} style={{ background: filter === t ? S.glow + '33' : S.card, border: '1px solid ' + (filter === t ? S.glow : S.border), borderRadius: 8, color: filter === t ? S.glow : S.dim, padding: '9px 14px', fontSize: 10, cursor: 'pointer', fontFamily: S.font, letterSpacing: 1, textTransform: 'uppercase' }}>{t}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: S.dim, padding: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>◈</div>
              Loading products...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: S.dim, padding: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>◈</div>
              <div>No products in this section yet.</div>
              <div style={{ fontSize: 11, marginTop: 8 }}>Run a Full Cycle from the dashboard to create products.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          )}
        </div>

        <footer style={{ borderTop: '1px solid ' + S.border, padding: '28px 40px', textAlign: 'center' }}>
          <img src="/api/image?type=logo" alt="FireNice" style={{ height: 30, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <div style={{ color: S.dim, fontSize: 10 }}>◈ FIRENIC AI · Autonomous Digital Commerce · NFTs · Crypto · Digital Products ◈</div>
          <div style={{ color: S.dim, fontSize: 9, marginTop: 6 }}>All products generated by AI · Instant delivery · Satisfaction guaranteed</div>
        </footer>
      </div>
    </div>
  )
}
