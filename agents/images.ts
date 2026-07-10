import { Octokit } from '@octokit/rest'
import { generateImageAuto } from '../lib/ai'

const owner = process.env.GITHUB_OWNER || 'fireniceinc'
const repo = process.env.GITHUB_REPO || 'worker-ai'

function octo() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN })
}

function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KEYWORD_PALETTES: { keys: string[]; hueBase: number; hueRange: number }[] = [
  { keys: ['ocean', 'water', 'wave', 'sea', 'aqua'], hueBase: 195, hueRange: 30 },
  { keys: ['fire', 'flame', 'ember', 'lava', 'inferno'], hueBase: 15, hueRange: 25 },
  { keys: ['forest', 'nature', 'leaf', 'jungle', 'earth'], hueBase: 130, hueRange: 30 },
  { keys: ['gold', 'royal', 'luxury', 'crown', 'treasure'], hueBase: 45, hueRange: 15 },
  { keys: ['space', 'cosmic', 'galaxy', 'star', 'nebula', 'void'], hueBase: 260, hueRange: 40 },
  { keys: ['neon', 'cyber', 'tech', 'digital', 'matrix'], hueBase: 300, hueRange: 50 },
  { keys: ['shadow', 'dark', 'night', 'mystery', 'gothic'], hueBase: 270, hueRange: 20 },
  { keys: ['ice', 'frost', 'winter', 'crystal', 'glacier'], hueBase: 185, hueRange: 20 },
  { keys: ['sunset', 'dawn', 'horizon', 'twilight'], hueBase: 25, hueRange: 35 },
  { keys: ['blood', 'crimson', 'rose', 'ruby'], hueBase: 350, hueRange: 15 },
  { keys: ['toxic', 'acid', 'venom', 'poison'], hueBase: 95, hueRange: 20 },
  { keys: ['electric', 'thunder', 'storm', 'lightning'], hueBase: 220, hueRange: 30 }
]

function deriveHue(text: string, seed: number): number {
  const lower = text.toLowerCase()
  for (const p of KEYWORD_PALETTES) {
    if (p.keys.some(k => lower.includes(k))) {
      const rand = mulberry32(seed + 1)
      return (p.hueBase + (rand() * p.hueRange * 2 - p.hueRange) + 360) % 360
    }
  }
  return seed % 360
}

export function generateNFTArt(params: { name: string; concept: string; seed?: number }): string {
  const fullText = params.name + ' ' + params.concept
  const seed = params.seed || hashString(fullText)
  const rand = mulberry32(seed)
  const hue1 = deriveHue(fullText, seed)
  const hue2 = (hue1 + 40 + rand() * 60) % 360
  const hue3 = (hue1 - 50 + 360) % 360

  const W = 1024, H = 1024, cx = W / 2, cy = H / 2

  const blobs: string[] = []
  const blobCount = 4 + Math.floor(rand() * 3)
  for (let i = 0; i < blobCount; i++) {
    const bx = rand() * W
    const by = rand() * H
    const br = 120 + rand() * 220
    const bh = (hue1 + i * 25 + rand() * 30) % 360
    const op = (0.08 + rand() * 0.14).toFixed(2)
    blobs.push('<ellipse cx="' + bx.toFixed(0) + '" cy="' + by.toFixed(0) + '" rx="' + br.toFixed(0) + '" ry="' + (br * (0.6 + rand() * 0.6)).toFixed(0) + '" fill="hsl(' + bh.toFixed(0) + ',75%,55%)" opacity="' + op + '" filter="url(#softblur)" transform="rotate(' + (rand() * 360).toFixed(0) + ' ' + bx.toFixed(0) + ' ' + by.toFixed(0) + ')"/>')
  }

  const ribbons: string[] = []
  const ribbonCount = 3 + Math.floor(rand() * 2)
  for (let i = 0; i < ribbonCount; i++) {
    const sx = rand() * W, sy = rand() * H
    const c1x = rand() * W, c1y = rand() * H
    const c2x = rand() * W, c2y = rand() * H
    const ex = rand() * W, ey = rand() * H
    const rh = (hue2 + i * 30) % 360
    ribbons.push('<path d="M' + sx.toFixed(0) + ',' + sy.toFixed(0) + ' C' + c1x.toFixed(0) + ',' + c1y.toFixed(0) + ' ' + c2x.toFixed(0) + ',' + c2y.toFixed(0) + ' ' + ex.toFixed(0) + ',' + ey.toFixed(0) + '" stroke="hsl(' + rh.toFixed(0) + ',85%,65%)" stroke-width="' + (1.5 + rand() * 3).toFixed(1) + '" fill="none" opacity="' + (0.25 + rand() * 0.3).toFixed(2) + '"/>')
  }

  const particles: string[] = []
  const particleCount = 50 + Math.floor(rand() * 40)
  for (let i = 0; i < particleCount; i++) {
    const px = rand() * W, py = rand() * H
    const psize = 0.5 + rand() * 3.5
    const ph = (hue3 + rand() * 60) % 360
    particles.push('<circle cx="' + px.toFixed(0) + '" cy="' + py.toFixed(0) + '" r="' + psize.toFixed(1) + '" fill="hsl(' + ph.toFixed(0) + ',90%,70%)" opacity="' + (0.2 + rand() * 0.5).toFixed(2) + '"/>')
  }

  const shapeType = Math.floor(rand() * 4)
  const emblemRadius = 110 + rand() * 50
  const emblemRotation = rand() * 360
  let emblemPath = ''
  if (shapeType === 0) {
    emblemPath = '<circle cx="' + cx + '" cy="' + cy + '" r="' + emblemRadius.toFixed(0) + '" fill="none" stroke="hsl(' + hue1.toFixed(0) + ',90%,65%)" stroke-width="2.5" opacity="0.85"/>'
  } else if (shapeType === 1) {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 + emblemRotation) * Math.PI / 180
      return (cx + emblemRadius * Math.cos(a)).toFixed(0) + ',' + (cy + emblemRadius * Math.sin(a)).toFixed(0)
    }).join(' ')
    emblemPath = '<polygon points="' + pts + '" fill="none" stroke="hsl(' + hue1.toFixed(0) + ',90%,65%)" stroke-width="2.5" opacity="0.85"/>'
  } else if (shapeType === 2) {
    const pts = [0, 90, 180, 270].map(a => {
      const rad = (a + emblemRotation) * Math.PI / 180
      return (cx + emblemRadius * Math.cos(rad)).toFixed(0) + ',' + (cy + emblemRadius * Math.sin(rad)).toFixed(0)
    }).join(' ')
    emblemPath = '<polygon points="' + pts + '" fill="none" stroke="hsl(' + hue1.toFixed(0) + ',90%,65%)" stroke-width="2.5" opacity="0.85"/>'
  } else {
    const pts: string[] = []
    for (let i = 0; i < 10; i++) {
      const a = (i * 36 + emblemRotation) * Math.PI / 180
      const r = i % 2 === 0 ? emblemRadius : emblemRadius * 0.45
      pts.push((cx + r * Math.cos(a)).toFixed(0) + ',' + (cy + r * Math.sin(a)).toFixed(0))
    }
    emblemPath = '<polygon points="' + pts.join(' ') + '" fill="none" stroke="hsl(' + hue1.toFixed(0) + ',90%,65%)" stroke-width="2.5" opacity="0.85"/>'
  }

  const innerRings = Array.from({ length: 3 }, (_, i) => {
    const r = emblemRadius * 0.5 - i * 18
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(0) + '" fill="none" stroke="hsl(' + ((hue1 + i * 20) % 360).toFixed(0) + ',85%,60%)" stroke-width="1" opacity="' + (0.3 - i * 0.07).toFixed(2) + '"/>'
  }).join('')

  const seedDisplay = String(seed).slice(-6)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bgmain" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="hsl(${hue1.toFixed(0)},35%,10%)"/>
      <stop offset="100%" stop-color="hsl(${hue3.toFixed(0)},45%,3%)"/>
    </radialGradient>
    <radialGradient id="emblowGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="hsl(${hue1.toFixed(0)},90%,60%)" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="hsl(${hue1.toFixed(0)},90%,60%)" stop-opacity="0"/>
    </radialGradient>
    <filter id="softblur"><feGaussianBlur stdDeviation="35"/></filter>
    <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgmain)"/>
  ${blobs.join('')}
  ${ribbons.join('')}
  ${particles.join('')}
  <circle cx="${cx}" cy="${cy}" r="${(emblemRadius * 1.3).toFixed(0)}" fill="url(#emblowGlow)"/>
  <g filter="url(#glow)">
    ${innerRings}
    ${emblemPath}
  </g>
  <text x="${W - 30}" y="${H - 24}" text-anchor="end" font-family="ui-monospace,monospace" font-size="13" fill="hsl(${hue1.toFixed(0)},60%,55%)" letter-spacing="2" opacity="0.7">FIRENIC GENESIS #${seedDisplay}</text>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" fill="none" stroke="hsl(${hue1.toFixed(0)},70%,55%)" stroke-width="1" opacity="0.25" rx="4"/>
</svg>`
}

export function generateProductSVG(params: { name: string; type: string; price: string; index?: number }): string {
  const typeConfig: Record<string, { color: string; icon: string }> = {
    'nft': { color: '#ff44aa', icon: '◈' }, 'crypto': { color: '#f7931a', icon: '₿' },
    'prompt-pack': { color: '#00ffaa', icon: '⚡' }, 'ebook': { color: '#4466ff', icon: '◉' },
    'template': { color: '#aa66ff', icon: '▦' }, 'guide': { color: '#ffaa00', icon: '◎' },
    'art-collection': { color: '#ff6644', icon: '✦' }, 'service': { color: '#44ffff', icon: '⚙' },
    'digital': { color: '#4499ff', icon: '◆' }, 'music': { color: '#ff77dd', icon: '♪' },
    'video': { color: '#f7931a', icon: '▶' }
  }
  const cfg = typeConfig[params.type] || typeConfig['digital']
  const n = params.index || 0
  const seed = hashString(params.name + n)
  const rand = mulberry32(seed)

  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = rand() * 360 * Math.PI / 180
    const r = 80 + rand() * 90
    const px = (512 + r * Math.cos(angle)).toFixed(1)
    const py = (290 + r * Math.sin(angle)).toFixed(1)
    return '<circle cx="' + px + '" cy="' + py + '" r="' + (1 + rand() * 3).toFixed(1) + '" fill="' + cfg.color + '" opacity="' + (0.15 + rand() * 0.25).toFixed(2) + '"/>'
  }).join('')

  const words = params.name.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 18 && cur) { lines.push(cur.trim()); cur = w } else cur = cur ? cur + ' ' + w : w
  }
  if (cur) lines.push(cur.trim())
  const nameLines = lines.slice(0, 3)
  const baseY = nameLines.length === 1 ? 365 : nameLines.length === 2 ? 352 : 340
  const nameSvg = nameLines.map((l, i) => '<text x="512" y="' + (baseY + i * 26) + '" text-anchor="middle" font-family="ui-monospace,monospace" font-size="19" font-weight="700" fill="#d0d8ff">' + l + '</text>').join('')
  const lastY = baseY + (nameLines.length - 1) * 26

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="600" viewBox="0 0 1024 600">
  <defs>
    <radialGradient id="rb${n}" cx="50%" cy="44%" r="65%"><stop offset="0%" stop-color="${cfg.color}" stop-opacity="0.1"/><stop offset="100%" stop-color="#050510"/></radialGradient>
    <filter id="rf${n}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1024" height="600" fill="url(#rb${n})"/>
  ${particles}
  <circle cx="512" cy="290" r="40" fill="${cfg.color}" opacity="0.1"/>
  <text x="512" y="308" text-anchor="middle" font-size="52" fill="${cfg.color}" filter="url(#rf${n})">${cfg.icon}</text>
  ${nameSvg}
  <text x="512" y="${lastY + 24}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="${cfg.color}" letter-spacing="3" opacity="0.7">${params.type.toUpperCase().replace('-', ' ')}</text>
  <text x="512" y="${lastY + 56}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="26" font-weight="900" fill="#00ffaa">${params.price}</text>
  <rect x="16" y="16" width="992" height="568" fill="none" stroke="${cfg.color}" stroke-width="0.8" opacity="0.12" rx="6"/>
</svg>`
}

export function generateLogoSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="110" viewBox="0 0 400 110">
  <defs><linearGradient id="tg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#d0d8ff"/><stop offset="50%" stop-color="#aa66ff"/><stop offset="100%" stop-color="#4466ff"/></linearGradient></defs>
  <rect width="400" height="110" fill="#050510"/>
  <polygon points="55,8 63,30 86,30 68,44 75,66 55,52 35,66 42,44 24,30 47,30" fill="#aa66ff" opacity="0.92"/>
  <circle cx="55" cy="40" r="7" fill="#00ffaa"/>
  <text x="112" y="48" font-family="ui-monospace,monospace" font-size="34" font-weight="900" fill="url(#tg)" letter-spacing="4">FIRENIC</text>
  <text x="113" y="70" font-family="ui-monospace,monospace" font-size="12" fill="#4455aa" letter-spacing="5">AI PRODUCTS</text>
</svg>`
}

async function saveToGitHub(content: string, filename: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token || token === 'placeholder') return null
  try {
    const path = 'public/images/' + filename
    const base64Content = Buffer.from(content, 'binary').toString('base64')
    let sha: string | undefined
    try { const ex = await octo().repos.getContent({ owner, repo, path }); sha = (ex.data as any).sha } catch {}
    await octo().repos.createOrUpdateFileContents({ owner, repo, path, message: 'Add image: ' + filename, content: base64Content, ...(sha ? { sha } : {}) })
    return 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/main/' + path
  } catch { return null }
}

export async function generateAndSaveImage(
  prompt: string,
  filename: string,
  productName?: string,
  productType?: string,
  productPrice?: string,
  seed?: number
): Promise<{ url: string; permanent: boolean; source: string }> {
  const result = await generateImageAuto(prompt)

  let imageBuffer: Buffer | null = null

  if (result.base64) {
    imageBuffer = Buffer.from(result.base64, 'base64')
  } else if (result.url) {
    try {
      const r = await fetch(result.url)
      if (r.ok) imageBuffer = Buffer.from(await r.arrayBuffer())
    } catch {}
  }

  if (imageBuffer && imageBuffer.length > 1000) {
    const permanentUrl = await saveToGitHub(imageBuffer.toString('binary'), filename)
    if (permanentUrl) return { url: permanentUrl, permanent: true, source: result.model }
    return { url: 'data:image/png;base64,' + imageBuffer.toString('base64'), permanent: false, source: result.model + '_base64' }
  }

  const isNFT = productType === 'nft'
  const svg = isNFT
    ? generateNFTArt({ name: productName || 'Genesis', concept: prompt, seed })
    : generateProductSVG({ name: productName || 'Product', type: productType || 'digital', price: productPrice || '$9.97', index: seed })

  const svgFilename = filename.replace(/\.(png|jpg)$/, '.svg')
  const permanentSvgUrl = await saveToGitHub(svg, svgFilename)
  if (permanentSvgUrl) return { url: permanentSvgUrl, permanent: true, source: 'svg_fallback' }

  return { url: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), permanent: false, source: 'svg_inline' }
}
