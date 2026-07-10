export async function createProduct(
  name: string,
  description: string,
  priceCents: number,
  fileContent: string
): Promise<{ id: string; url: string; shortUrl: string }> {
  const token = process.env.GUMROAD_ACCESS_TOKEN
  if (!token || token === 'placeholder') throw new Error('GUMROAD_ACCESS_TOKEN not configured')
  const params = new URLSearchParams({ name, description, price: String(priceCents), published: 'true' })
  const res = await fetch('https://api.gumroad.com/v2/products', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })
  if (!res.ok) throw new Error('Gumroad error: ' + await res.text())
  const data = await res.json()
  if (!data.success) throw new Error('Gumroad failed: ' + JSON.stringify(data))
  const product = data.product
  return {
    id: product.id,
    url: product.long_url || 'https://gumroad.com/l/' + product.id,
    shortUrl: product.short_url || 'https://gumroad.com/l/' + product.id
  }
}

export async function getBalance(): Promise<number> {
  try {
    const token = process.env.GUMROAD_ACCESS_TOKEN
    if (!token || token === 'placeholder') return 0
    const r = await fetch('https://api.gumroad.com/v2/user', {
      headers: { Authorization: 'Bearer ' + token }
    })
    if (!r.ok) return 0
    const d = await r.json()
    return d.user?.balance_cents || 0
  } catch { return 0 }
}

export async function getSales(): Promise<any[]> {
  try {
    const token = process.env.GUMROAD_ACCESS_TOKEN
    if (!token || token === 'placeholder') return []
    const r = await fetch('https://api.gumroad.com/v2/sales', {
      headers: { Authorization: 'Bearer ' + token }
    })
    if (!r.ok) return []
    const d = await r.json()
    return Array.isArray(d.sales) ? d.sales : []
  } catch { return [] }
}
