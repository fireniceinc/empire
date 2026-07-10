import { createClient } from '@supabase/supabase-js'
import { generateText, generateJSON } from '../lib/ai'
import { Octokit } from '@octokit/rest'

const db = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder'
)

async function logAgent(agentName: string, action: string, result: string, status: 'success' | 'error', error?: string): Promise<void> {
  try { await db.from('agent_logs').insert({ agent_name: agentName, action, result, status, error: error || null }) } catch {}
}

export async function analyzeBusinessCycle(): Promise<{
  score: number
  problems: string[]
  wins: string[]
  recommendations: string[]
  report: string
}> {
  await logAgent('analytics', 'analyzing', 'Full business cycle analysis', 'success')

  const [productsRes, transactionsRes, logsRes, campaignsRes] = await Promise.allSettled([
    db.from('products').select('*').order('created_at', { ascending: false }).limit(20),
    db.from('transactions').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('agent_logs').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(50)
  ])

  const products = productsRes.status === 'fulfilled' ? (productsRes.value.data || []) : []
  const transactions = transactionsRes.status === 'fulfilled' ? (transactionsRes.value.data || []) : []
  const logs = logsRes.status === 'fulfilled' ? (logsRes.value.data || []) : []
  const campaigns = campaignsRes.status === 'fulfilled' ? (campaignsRes.value.data || []) : []

  const errorLogs = logs.filter((l: any) => l.status === 'error')
  const postedCampaigns = campaigns.filter((c: any) => c.status === 'posted')
  const listedProducts = products.filter((p: any) => p.gumroad_url)
  const totalRevenue = transactions.reduce((sum: number, t: any) => sum + (t.amount_cents || 0), 0)
  const conversionRate = listedProducts.length > 0 ? (transactions.length / listedProducts.length * 100).toFixed(1) : '0'

  const analysisData = {
    totalProducts: products.length,
    listedProducts: listedProducts.length,
    totalRevenueDollars: (totalRevenue / 100).toFixed(2),
    totalTransactions: transactions.length,
    conversionRate: conversionRate + '%',
    errorRate: logs.length > 0 ? (errorLogs.length / logs.length * 100).toFixed(1) + '%' : '0%',
    marketingCampaignsPosted: postedCampaigns.length,
    topErrors: errorLogs.slice(0, 5).map((l: any) => l.agent_name + ': ' + l.action + ' - ' + (l.error || 'unknown')),
    recentProducts: products.slice(0, 3).map((p: any) => p.name + ' ($' + ((p.price_cents || 0) / 100).toFixed(2) + ') - ' + (p.sales_count || 0) + ' sales')
  }

  try {
    const analysis = await generateJSON(
      'You are analyzing an autonomous AI business engine. Based on this data, provide a business analysis.\n\nData: ' + JSON.stringify(analysisData) + '\n\nReturn JSON: {"score":0-100,"problems":["problem1","problem2"],"wins":["win1","win2"],"recommendations":["action1","action2","action3"],"marketingInsight":"one sentence","productInsight":"one sentence","priorityAction":"single most important thing to do next"}',
      1024
    )

    const reportLines = [
      'BUSINESS CYCLE ANALYSIS REPORT',
      'Generated: ' + new Date().toISOString(),
      '',
      'HEALTH SCORE: ' + analysis.score + '/100',
      '',
      'METRICS:',
      '  Products created: ' + analysisData.totalProducts,
      '  Products listed: ' + analysisData.listedProducts,
      '  Total revenue: $' + analysisData.totalRevenueDollars,
      '  Transactions: ' + analysisData.totalTransactions,
      '  Conversion rate: ' + analysisData.conversionRate,
      '  Error rate: ' + analysisData.errorRate,
      '  Campaigns posted: ' + analysisData.marketingCampaignsPosted,
      '',
      'PROBLEMS:',
      ...(analysis.problems || []).map((p: string) => '  ✗ ' + p),
      '',
      'WINS:',
      ...(analysis.wins || []).map((w: string) => '  ✓ ' + w),
      '',
      'RECOMMENDATIONS:',
      ...(analysis.recommendations || []).map((r: string) => '  → ' + r),
      '',
      'PRIORITY ACTION: ' + (analysis.priorityAction || 'Continue running full cycles'),
      '',
      'MARKETING INSIGHT: ' + (analysis.marketingInsight || 'N/A'),
      'PRODUCT INSIGHT: ' + (analysis.productInsight || 'N/A')
    ]

    const result = {
      score: analysis.score || 0,
      problems: analysis.problems || [],
      wins: analysis.wins || [],
      recommendations: analysis.recommendations || [],
      report: reportLines.join('\n')
    }

    await logAgent('analytics', 'analysis_complete', 'Score: ' + result.score, 'success')
    await db.from('system_state').upsert({ key: 'last_analysis_score', value: String(result.score), updated_at: new Date().toISOString() })
    await db.from('system_state').upsert({ key: 'last_analysis', value: new Date().toISOString(), updated_at: new Date().toISOString() })

    return result
  } catch (e: any) {
    const fallback = {
      score: 50,
      problems: errorLogs.length > 0 ? ['Error rate: ' + analysisData.errorRate] : [],
      wins: transactions.length > 0 ? ['Revenue generated: $' + analysisData.totalRevenueDollars] : [],
      recommendations: ['Continue running full cycles', 'Monitor error logs', 'Add more marketing channels'],
      report: 'Analysis failed: ' + e.message + '\n\nBasic metrics:\n  Revenue: $' + analysisData.totalRevenueDollars + '\n  Products: ' + analysisData.totalProducts + '\n  Transactions: ' + analysisData.totalTransactions
    }
    return fallback
  }
}

export async function improveMarketing(): Promise<{ improved: boolean; changes: string[] }> {
  await logAgent('analytics', 'improving_marketing', 'Analyzing campaign performance', 'success')

  try {
    const { data: campaigns } = await db
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (!campaigns || campaigns.length === 0) return { improved: false, changes: ['No campaigns to analyze yet'] }

    const platformStats: Record<string, { total: number; posted: number }> = {}
    campaigns.forEach((c: any) => {
      if (!platformStats[c.platform]) platformStats[c.platform] = { total: 0, posted: 0 }
      platformStats[c.platform].total++
      if (c.status === 'posted') platformStats[c.platform].posted++
    })

    const analysis = await generateText(
      'Analyze these marketing campaign stats and suggest the top 3 improvements:\n\n' +
      Object.entries(platformStats).map(([platform, stats]) =>
        platform + ': ' + stats.posted + '/' + stats.total + ' posted'
      ).join('\n') +
      '\n\nProvide specific, actionable improvements to increase reach and conversions.',
      512
    )

    const changes = analysis.split('\n').filter(l => l.trim().length > 10).slice(0, 3)
    await logAgent('analytics', 'marketing_improved', changes.join('; '), 'success')
    await db.from('system_state').upsert({ key: 'marketing_improvements', value: changes.join('|'), updated_at: new Date().toISOString() })

    return { improved: true, changes }
  } catch (e: any) {
    return { improved: false, changes: ['Analysis failed: ' + e.message] }
  }
}

export async function findBestProductIdeas(): Promise<string[]> {
  await logAgent('analytics', 'finding_opportunities', 'Analyzing what sells', 'success')

  try {
    const { data: products } = await db.from('products').select('name, type, price_cents, sales_count, revenue_cents').order('revenue_cents', { ascending: false }).limit(10)
    const { data: transactions } = await db.from('transactions').select('amount_cents, created_at').order('created_at', { ascending: false }).limit(20)

    const topProducts = products || []
    const recentSales = transactions ? transactions.length : 0

    const ideas = await generateJSON(
      'Based on these top-performing digital products, suggest 5 new product ideas that would likely sell well.\n\nTop products: ' + JSON.stringify(topProducts.map((p: any) => ({ name: p.name, type: p.type, sales: p.sales_count || 0 }))) + '\nRecent sales: ' + recentSales + '\n\nReturn JSON array of strings: ["idea1","idea2","idea3","idea4","idea5"]',
      512
    )

    const ideaList = Array.isArray(ideas) ? ideas.map(String) : ['AI prompt packs', 'Productivity templates', 'Business plan guides', 'Social media kits', 'Resume templates']
    await db.from('system_state').upsert({ key: 'product_ideas', value: ideaList.join('|'), updated_at: new Date().toISOString() })
    await logAgent('analytics', 'ideas_found', ideaList.length + ' ideas', 'success')

    return ideaList
  } catch {
    return ['AI prompt packs for entrepreneurs', 'Productivity template bundle', 'Digital marketing guide', 'Business plan template', 'Social media content kit']
  }
}

export async function selfImprove(): Promise<{ improved: boolean; actions: string[] }> {
  await logAgent('analytics', 'self_improve_start', 'Running self-improvement cycle', 'success')

  const actions: string[] = []

  try {
    const analysis = await analyzeBusinessCycle()
    actions.push('Analysis complete — score: ' + analysis.score)

    if (analysis.score < 60) {
      const marketing = await improveMarketing()
      if (marketing.improved) actions.push('Marketing improved: ' + marketing.changes[0])
    }

    const ideas = await findBestProductIdeas()
    actions.push('Found ' + ideas.length + ' new product ideas')

    if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== 'placeholder') {
      const token = process.env.GITHUB_TOKEN
      const owner = process.env.GITHUB_OWNER || ''
      const repo = process.env.GITHUB_REPO || 'worker-ai'
      const octokit = new Octokit({ auth: token })

      if (analysis.problems.length > 0) {
        const issueBody = [
          '## Auto-generated improvement report',
          '',
          '**Health Score:** ' + analysis.score + '/100',
          '',
          '**Problems found:**',
          ...analysis.problems.map(p => '- ' + p),
          '',
          '**Recommendations:**',
          ...analysis.recommendations.map(r => '- ' + r),
          '',
          '**New product ideas:**',
          ...ideas.map(i => '- ' + i),
          '',
          '*Generated automatically by Worker AI analytics agent*'
        ].join('\n')

        try {
          await octokit.issues.create({
            owner, repo,
            title: 'Auto-Analysis: Business Health ' + analysis.score + '/100 — ' + new Date().toLocaleDateString(),
            body: issueBody,
            labels: ['auto-generated', 'improvement']
          })
          actions.push('GitHub issue created with improvement report')
        } catch {}
      }
    }

    await logAgent('analytics', 'self_improve_complete', actions.length + ' actions taken', 'success')
    return { improved: true, actions }
  } catch (e: any) {
    await logAgent('analytics', 'self_improve_failed', e.message, 'error', e.message)
    return { improved: false, actions: ['Failed: ' + e.message] }
  }
}
