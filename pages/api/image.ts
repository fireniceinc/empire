import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { generateProductSVG, generateLogoSVG } from '../../agents/images'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || '')
  const type = String(req.query.type || '')

  if (type === 'logo') {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.send(generateLogoSVG())
  }

  if (!id) {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.send(generateProductSVG({ name: 'AI Product', type: 'digital', price: '$9.97' }))
  }

  try {
    // Single row, and this endpoint itself is cached hard below — this is the ONLY
    // place file_content should ever be selected on a repeated/automated basis.
    const { data } = await db.from('products').select('id, name, type, price_cents, file_content').eq('id', id).limit(1)
    const product = data && data.length > 0 ? data[0] : null

    if (!product) {
      res.setHeader('Content-Type', 'image/svg+xml')
      return res.send(generateProductSVG({ name: 'Product', type: 'digital', price: '$9.97' }))
    }

    const content = String(product.file_content || '')
    const price = '$' + ((product.price_cents || 0) / 100).toFixed(2)
    const idNum = parseInt(id.replace(/\D/g, '').slice(-4) || '1')

    if (content.startsWith('data:image/png;base64,') || content.startsWith('data:image/svg+xml;base64,')) {
      const commaIdx = content.indexOf(',')
      const header = content.slice(5, commaIdx)
      const mime = header.split(';')[0]
      const buf = Buffer.from(content.slice(commaIdx + 1).replace(/\s/g, ''), 'base64')
      if (buf.length > 500) {
        res.setHeader('Content-Type', mime)
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
        return res.send(buf)
      }
    }

    const svgInline = content.indexOf('<svg')
    if (svgInline !== -1) {
      const svgEnd = content.lastIndexOf('</svg>') + 6
      if (svgEnd > svgInline) {
        res.setHeader('Content-Type', 'image/svg+xml')
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
        return res.send(content.slice(svgInline, svgEnd))
      }
    }

    const firstLine = content.split('\n')[0].trim()
    if (firstLine.startsWith('https://raw.githubusercontent.com')) {
      const r = await fetch(firstLine)
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer())
        if (buf.length > 500) {
          res.setHeader('Content-Type', r.headers.get('content-type') || 'image/png')
          res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
          return res.send(buf)
        }
      }
    }

    const svg = generateProductSVG({ name: product.name, type: product.type, price, index: idNum })
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.send(svg)
  } catch {
    res.setHeader('Content-Type', 'image/svg+xml')
    return res.send(generateProductSVG({ name: 'Product', type: 'digital', price: '$9.97' }))
  }
}
