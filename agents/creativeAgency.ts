import { createClient } from '@supabase/supabase-js'
import { generateText, getOpenAI } from '../lib/ai'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(agentName: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: agentName, action, result, status, error: error || null }) } catch {}
}

export function getProjectTypes(): string[] {
  return ['billboard', 'radio-spot', 'tv-commercial-script', 'social-media-campaign', 'poster-design', 'press-release', 'brand-identity', 'music-video-concept', 'podcast-script', 'product-launch-campaign']
}

export async function processClientProject(project: {
  clientName: string
  clientEmail: string
  projectType: string
  brief: string
  budgetCents: number
}): Promise<{ deliverables: string; status: string; projectId: string }> {
  const { data: inserted, error: insertError } = await db.from('client_projects').insert({
    client_name: project.clientName,
    client_email: project.clientEmail,
    project_type: project.projectType,
    brief: project.brief,
    budget_cents: project.budgetCents,
    status: 'in-progress'
  }).select()

  if (insertError) throw new Error('Failed to insert: ' + insertError.message)
  if (!inserted || !Array.isArray(inserted) || inserted.length === 0) throw new Error('No data returned from insert')
  const projectId = inserted[0].id

  await logAgent('creative_agency', 'project_start', project.projectType, 'success')

  const promptMap: Record<string, string> = {
    'billboard': 'Create 5 billboard headline variations for: ' + project.brief + '. Include visual direction and placement strategy.',
    'radio-spot': 'Write a 30-second AND 60-second radio script for: ' + project.brief + '. Include production notes.',
    'tv-commercial-script': 'Write a TV commercial storyboard for: ' + project.brief + '. Include scenes, dialogue, camera directions.',
    'social-media-campaign': 'Create a 30-day social media calendar for: ' + project.brief + '. Include Instagram, Twitter, LinkedIn posts.',
    'poster-design': 'Write a poster design brief for: ' + project.brief + '. Include layout, typography, colors, imagery.',
    'press-release': 'Write an AP-style press release for: ' + project.brief,
    'brand-identity': 'Create a brand identity guide for: ' + project.brief + '. Include names, taglines, values, visual guide.',
    'music-video-concept': 'Write a music video director treatment for: ' + project.brief,
    'podcast-script': 'Write a complete podcast episode script for: ' + project.brief,
    'product-launch-campaign': 'Create a complete product launch campaign for: ' + project.brief + '. Include press release, social posts, email sequence.'
  }

  const promptText = promptMap[project.projectType] || 'Create professional deliverables for this ' + project.projectType + ' project: ' + project.brief
  let deliverables = await generateText(promptText, 4096)

  if (project.projectType === 'poster-design' || project.projectType === 'billboard') {
    const openai = getOpenAI()
    if (openai) {
      try {
        const img = await openai.images.generate({ model: 'dall-e-3', prompt: 'Professional ' + project.projectType + ': ' + project.brief + '. Commercial advertising style.', n: 1, size: '1024x1024', quality: 'standard' })
        if (img.data[0]?.url) deliverables = deliverables + '\n\nCONCEPT IMAGE:\n' + img.data[0].url
      } catch {}
    }
  }

  await db.from('client_projects').update({ deliverables, status: 'delivered' }).eq('id', projectId)
  await logAgent('creative_agency', 'delivered', project.projectType, 'success')
  return { deliverables, status: 'delivered', projectId }
}
