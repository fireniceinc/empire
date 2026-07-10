import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logProvider(provider: string, action: string, status: 'success' | 'error', detail: string): Promise<void> {
  try {
    await db.from('agent_logs').insert({ agent_name: 'ai_provider', action, result: detail.slice(0, 200), status, provider })
  } catch {}
}

let _openai: OpenAI | null = null
let _anthropic: Anthropic | null = null

export function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY
  if (!key || key === 'placeholder' || key.length < 10) return null
  if (!_openai) _openai = new OpenAI({ apiKey: key })
  return _openai
}

export function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || key === 'placeholder' || key.length < 10) return null
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: key })
  return _anthropic
}

export async function generateText(prompt: string, maxTokens = 1024): Promise<string> {
  const openai = getOpenAI()
  if (openai) {
    try {
      const r = await openai.chat.completions.create({
        model: 'gpt-4o', max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = r.choices[0]?.message?.content || ''
      if (text.length > 0) {
        await logProvider('openai', 'generateText', 'success', text.slice(0, 60))
        return text
      }
    } catch (e: any) {
      await logProvider('openai', 'generateText', 'error', e.message || 'unknown')
    }
  } else {
    await logProvider('openai', 'generateText', 'error', 'OPENAI_API_KEY not configured')
  }

  const anthropic = getAnthropic()
  if (anthropic) {
    try {
      const r = await anthropic.messages.create({
        model: 'claude-opus-4-20250514', max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
      const block = r.content[0]
      const text = block && block.type === 'text' ? block.text : ''
      if (text.length > 0) {
        await logProvider('anthropic', 'generateText', 'success', text.slice(0, 60))
        return text
      }
    } catch (e: any) {
      await logProvider('anthropic', 'generateText', 'error', e.message || 'unknown')
    }
  } else {
    await logProvider('anthropic', 'generateText', 'error', 'ANTHROPIC_API_KEY not configured')
  }

  throw new Error('All text providers failed. Check OPENAI_API_KEY and ANTHROPIC_API_KEY.')
}

/** Deliberately calls Claude only — used for QC/second-opinion so Anthropic gets real, visible usage. */
export async function generateWithClaude(prompt: string, maxTokens = 1024): Promise<string | null> {
  const anthropic = getAnthropic()
  if (!anthropic) {
    await logProvider('anthropic', 'generateWithClaude', 'error', 'ANTHROPIC_API_KEY not configured')
    return null
  }
  try {
    const r = await anthropic.messages.create({
      model: 'claude-opus-4-20250514', max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
    const block = r.content[0]
    const text = block && block.type === 'text' ? block.text : ''
    await logProvider('anthropic', 'generateWithClaude', 'success', text.slice(0, 60))
    return text
  } catch (e: any) {
    await logProvider('anthropic', 'generateWithClaude', 'error', e.message || 'unknown')
    return null
  }
}

export async function generateJSON(prompt: string, maxTokens = 1024): Promise<any> {
  const fullPrompt = prompt + '\n\nReturn ONLY valid JSON. No markdown fences. No explanation.'
  const raw = await generateText(fullPrompt, maxTokens)
  const cleaned = raw.replace(/^```(?:json)?\n?/gm, '').replace(/```$/gm, '').trim()
  const objStart = cleaned.indexOf('{')
  const arrStart = cleaned.indexOf('[')
  const start = arrStart !== -1 && (objStart === -1 || arrStart < objStart) ? arrStart : objStart
  const sliced = start >= 0 ? cleaned.slice(start) : cleaned
  try {
    return JSON.parse(sliced)
  } catch (e: any) {
    const lastBrace = Math.max(sliced.lastIndexOf('}'), sliced.lastIndexOf(']'))
    if (lastBrace > 0) {
      try { return JSON.parse(sliced.slice(0, lastBrace + 1)) } catch {}
    }
    throw new Error('Could not parse JSON: ' + e.message)
  }
}

interface ImageResult { base64: string | null; url: string | null; model: string; error?: string }

async function tryDalle3(prompt: string): Promise<ImageResult> {
  const openai = getOpenAI()
  if (!openai) return { base64: null, url: null, model: 'dall-e-3', error: 'No OpenAI key' }
  try {
    const img = await openai.images.generate({
      model: 'dall-e-3', prompt: prompt.slice(0, 1000), n: 1, size: '1024x1024', quality: 'standard'
    })
    const url = img.data[0]?.url || null
    if (url) {
      await logProvider('openai', 'image_dalle3', 'success', url.slice(0, 60))
      return { base64: null, url, model: 'dall-e-3' }
    }
    return { base64: null, url: null, model: 'dall-e-3', error: 'No url in response' }
  } catch (e: any) {
    await logProvider('openai', 'image_dalle3', 'error', e.message || 'unknown')
    return { base64: null, url: null, model: 'dall-e-3', error: e.message }
  }
}

async function tryGptImage(prompt: string, model: 'gpt-image-1' | 'gpt-image-1-mini'): Promise<ImageResult> {
  const key = process.env.OPENAI_API_KEY
  if (!key || key === 'placeholder') return { base64: null, url: null, model, error: 'No OpenAI key' }
  try {
    // IMPORTANT: gpt-image models reject response_format entirely and always return b64_json.
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: prompt.slice(0, 1000), n: 1, size: '1024x1024', quality: 'medium' })
    })
    if (!r.ok) {
      const errText = await r.text()
      await logProvider('openai', 'image_' + model, 'error', errText.slice(0, 150))
      return { base64: null, url: null, model, error: errText.slice(0, 150) }
    }
    const d = await r.json()
    const b64 = d.data?.[0]?.b64_json || null
    if (b64) {
      await logProvider('openai', 'image_' + model, 'success', b64.length + ' base64 chars')
      return { base64: b64, url: null, model }
    }
    return { base64: null, url: null, model, error: 'No b64_json in response' }
  } catch (e: any) {
    await logProvider('openai', 'image_' + model, 'error', e.message || 'unknown')
    return { base64: null, url: null, model, error: e.message }
  }
}

export async function generateImageAuto(prompt: string): Promise<ImageResult> {
  const dalle = await tryDalle3(prompt)
  if (dalle.url) return dalle

  const gptImage = await tryGptImage(prompt, 'gpt-image-1')
  if (gptImage.base64) return gptImage

  const gptImageMini = await tryGptImage(prompt, 'gpt-image-1-mini')
  if (gptImageMini.base64) return gptImageMini

  return { base64: null, url: null, model: 'none', error: 'dalle3=' + dalle.error + ' | gpt-image-1=' + gptImage.error + ' | mini=' + gptImageMini.error }
}

export const openai = getOpenAI()
export const anthropic = getAnthropic()
