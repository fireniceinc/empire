import { createClient } from '@supabase/supabase-js'
import { generateText, generateJSON } from '../lib/ai'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

export function getTalentTypes(): string[] {
  return ['graphic-designer', 'photographer', 'videographer', 'musician', 'voice-actor', 'model', 'illustrator', 'copywriter', 'social-media-manager', 'web-developer', 'animator', 'audio-engineer']
}

export async function addTalent(profile: { name: string; type: string; bio: string; skills: string[]; portfolioUrl: string; ratePerHour: number; contactEmail: string }): Promise<string> {
  try {
    const { data } = await db.from('talent_profiles').insert({ name: profile.name, type: profile.type, bio: profile.bio, skills: profile.skills, portfolio_url: profile.portfolioUrl, rate_per_hour: profile.ratePerHour, contact_email: profile.contactEmail, available: true }).select()
    return data && Array.isArray(data) && data.length > 0 ? data[0].id : ''
  } catch { return '' }
}

export async function findTalent(projectType: string, budgetCents: number): Promise<any[]> {
  try {
    const maxRate = Math.floor(budgetCents / 800)
    const { data } = await db.from('talent_profiles').select('*').eq('available', true).lte('rate_per_hour', maxRate)
    if (!data || !Array.isArray(data) || data.length === 0) return []
    try {
      const ranked = await generateJSON('Rank these talent profiles for a ' + projectType + ' project. Return array of ids best to worst: ' + JSON.stringify(data.map(t => ({ id: t.id, type: t.type, skills: t.skills }))))
      if (Array.isArray(ranked)) return ranked.slice(0, 5).map((id: string) => data.find(t => t.id === id)).filter(Boolean)
    } catch {}
    return data.slice(0, 5)
  } catch { return [] }
}

export async function seedSampleTalent(): Promise<number> {
  try {
    const profiles = await generateJSON('Generate 3 realistic talent profiles. Return JSON array: [{"name":"...","type":"graphic-designer","bio":"...","skills":["skill1","skill2"],"portfolioUrl":"https://example.com","ratePerHour":50,"contactEmail":"talent@example.com"}]')
    if (!Array.isArray(profiles) || profiles.length === 0) return 0
    const { data } = await db.from('talent_profiles').insert(profiles.map((p: any) => ({ name: p.name || 'Talent', type: p.type || 'graphic-designer', bio: p.bio || '', skills: Array.isArray(p.skills) ? p.skills : [], portfolio_url: p.portfolioUrl || '', rate_per_hour: p.ratePerHour || 50, contact_email: p.contactEmail || '', available: true }))).select()
    return data && Array.isArray(data) ? data.length : 0
  } catch { return 0 }
}
