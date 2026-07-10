import { useState } from 'react'

const S = {
  bg: '#050510', card: 'rgba(10,12,40,0.95)', border: 'rgba(100,120,255,0.2)',
  glow: '#4466ff', green: '#00ffaa', text: '#d0d8ff', dim: '#4455aa',
  accent: '#aa66ff', red: '#ff4466', font: 'ui-monospace, monospace'
}

export default function Success() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState<any>(null)
  const [error, setError] = useState('')
  const [downloaded, setDownloaded] = useState(false)

  async function lookup() {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/download?email=' + encodeURIComponent(email.trim().toLowerCase()))
      const d = await r.json()
      if (d.error) { setError(d.error); setLoading(false); return }
      setProduct(d)
    } catch (e: any) {
      setError('Could not look up purchase: ' + e.message)
    }
    setLoading(false)
  }

  function downloadProduct() {
    if (!product) return
    const content = product.content || product.file_content || 'No content available'
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = product.name.replace(/\s+/g, '-') + '.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: S.font, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 30% 40%, rgba(68,102,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(170,102,255,0.08) 0%, transparent 60%)' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <svg width="60" height="60" viewBox="0 0 48 48" style={{ filter: 'drop-shadow(0 0 12px #4466ff)', marginBottom: 16 }}>
            <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#aa66ff" /><stop offset="100%" stopColor="#4466ff" stopOpacity="0" /></radialGradient></defs>
            <polygon points="24,2 30,18 46,18 33,28 38,44 24,34 10,44 15,28 2,18 18,18" fill="url(#g)" />
            <circle cx="24" cy="24" r="4" fill="#00ffaa" />
          </svg>
          <div style={{ fontSize: 11, color: S.accent, letterSpacing: 4, marginBottom: 12 }}>FIRENIC AI</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px', background: 'linear-gradient(135deg, #d0d8ff, #aa66ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {product ? 'Your Product is Ready' : 'Thank You for Your Purchase!'}
          </h1>
          <p style={{ color: S.dim, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            {product ? 'Download your product below. Check your email for a copy.' : 'Enter the email you used to pay and we will retrieve your product instantly.'}
          </p>
        </div>

        <div style={{ background: S.card, border: '1px solid ' + S.border, borderRadius: 16, padding: 32 }}>
          {!product ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: S.dim, fontSize: 11, letterSpacing: 1, display: 'block', marginBottom: 8 }}>YOUR PAYMENT EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookup()}
                  placeholder="email@example.com"
                  style={{ width: '100%', background: S.bg, border: '1px solid ' + S.border, borderRadius: 10, color: S.text, padding: '14px 16px', fontFamily: S.font, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {error && <div style={{ color: S.red, fontSize: 12, marginBottom: 16, padding: '10px 14px', background: S.red + '11', borderRadius: 8, border: '1px solid ' + S.red + '33' }}>{error}</div>}
              <button
                onClick={lookup}
                disabled={loading}
                style={{ width: '100%', background: loading ? S.dim + '22' : 'linear-gradient(135deg, rgba(68,102,255,0.4), rgba(170,102,255,0.3))', border: '1px solid ' + (loading ? S.border : S.glow + '88'), borderRadius: 10, color: loading ? S.dim : S.text, padding: '14px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: S.font, letterSpacing: 1 }}
              >
                {loading ? '⟳ Looking up your purchase...' : '→ GET MY PRODUCT'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 20, color: S.dim, fontSize: 11 }}>
                Can not find your purchase? Email us at {process.env.NEXT_PUBLIC_FROM_EMAIL || 'support@firenic.ai'}
              </div>
            </>
          ) : (
            <>
              <div style={{ background: S.green + '11', border: '1px solid ' + S.green + '33', borderRadius: 10, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>✓</span>
                <div>
                  <div style={{ color: S.green, fontWeight: 700 }}>Purchase verified</div>
                  <div style={{ color: S.dim, fontSize: 12 }}>Your download is ready</div>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ color: S.dim, fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>YOUR PRODUCT</div>
                <div style={{ color: S.text, fontSize: 18, fontWeight: 700 }}>{product.name}</div>
                <div style={{ color: S.dim, fontSize: 12, marginTop: 4 }}>{product.description}</div>
              </div>

              <button
                onClick={downloadProduct}
                style={{ width: '100%', background: downloaded ? S.green + '22' : 'linear-gradient(135deg, rgba(0,255,170,0.3), rgba(68,102,255,0.2))', border: '1px solid ' + (downloaded ? S.green : S.green + '88'), borderRadius: 10, color: downloaded ? S.green : S.text, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: S.font, letterSpacing: 1, marginBottom: 12 }}
              >
                {downloaded ? '✓ Downloaded! Click to download again' : '⬇ DOWNLOAD ' + product.name.toUpperCase()}
              </button>

              {product.type === 'nft' && product.image_url && (
                <div style={{ marginBottom: 16 }}>
                  <img src={product.image_url} alt={product.name} style={{ width: '100%', borderRadius: 10, border: '1px solid ' + S.border }} />
                  <a href={product.image_url} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', color: S.accent, fontSize: 12, marginTop: 8, textDecoration: 'none' }}>
                    → View full NFT image
                  </a>
                </div>
              )}

              <div style={{ background: S.bg, border: '1px solid ' + S.border, borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
                <div style={{ color: S.dim, fontSize: 10, marginBottom: 8 }}>PRODUCT PREVIEW</div>
                <pre style={{ color: S.text, fontSize: 11, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>
                  {(product.content || product.file_content || '').slice(0, 500)}...
                </pre>
              </div>

              <div style={{ textAlign: 'center', marginTop: 16, color: S.dim, fontSize: 11 }}>
                A copy has been sent to your email. Reply if you have questions.
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <a href="/store" style={{ color: S.dim, fontSize: 12, textDecoration: 'none' }}>← Browse more products</a>
        </div>
      </div>
    </div>
  )
}
