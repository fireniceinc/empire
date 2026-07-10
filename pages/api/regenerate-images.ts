import type { NextApiRequest, NextApiResponse } from 'next'
import { regenerateAllImages } from '../../agents/imageRegen'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json')

  const dryRun = req.query.dry === 'true'
  const limit = parseInt(String(req.query.limit || '200'))
  const type = String(req.query.type || 'all')

  try {
    const results = await regenerateAllImages({ dryRun, limit, type })
    return res.json({
      ...results,
      message: dryRun
        ? 'DRY RUN — ' + results.needed + ' products would get images'
        : 'Done — ' + results.updated + ' images generated, ' + results.skipped + ' already had images'
    })
  } catch (e: any) {
    return res.json({ error: e.message })
  }
}
