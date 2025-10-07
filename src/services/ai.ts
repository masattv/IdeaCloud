const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
const OPENAI_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4o-mini'

type TagResult = { tags: string[]; confidence: number }
export type ClusterResult = { id: string; label: string; memberIds: string[]; keywords: string[] }[]
export type Insight = { summary: string; next_steps: string[]; titles: string[] }

type PreviousClusterHint = {
  id: string
  label: string
  memberIds: string[]
  keywords: string[]
}

type PreviousInsight = {
  summary: string
  next_steps: string[]
  titles: string[]
  item_count: number
}

function assertEnv() { if (!OPENAI_API_KEY) throw new Error('VITE_OPENAI_API_KEY is missing') }

async function openaiJson(system: string, user: unknown, retry = 2): Promise<any> {
  assertEnv()
  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: system + '\n必ず有効なJSONのみを返してください。コードブロックは禁止。' },
      { role: 'user', content: JSON.stringify(user) }
    ],
    temperature: 0.2
  }
  for (let i = 0; i <= retry; i++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      if (res.status >= 500 && i < retry) { await new Promise(r => setTimeout(r, 300*(i+1))); continue }
      throw new Error('OpenAI error: ' + res.status)
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    try { return JSON.parse(content) } catch { if (i < retry) continue; throw new Error('JSON parse failed') }
  }
}

export async function tagIdea(text: string, existingTags: string[] = []): Promise<TagResult> {
  const system = '短文から日本語タグを最大2つ抽出し、{"tags":[],"confidence":0-1}で返す。既存タグが近ければ優先。'
  const user = { text, existingTags }
  return await openaiJson(system, user)
}

function normalizeClusterResult(raw: any): ClusterResult {
  const source = Array.isArray(raw) ? raw : Array.isArray(raw?.clusters) ? raw.clusters : null
  if (!source) throw new Error('クラスタ結果の形式が正しくありません。AIの応答を確認してください。')
  return source
    .map((c: any, i: number) => ({
      id: String(c?.id || `cluster-${i + 1}`),
      label: String(c?.label || `クラスタ${i + 1}`),
      memberIds: Array.isArray(c?.memberIds) ? c.memberIds.map((m: any) => String(m)) : [],
      keywords: Array.isArray(c?.keywords) ? c.keywords.map((k: any) => String(k)) : []
    }))
    .filter(
      (c: { id: string; label: string; memberIds: string[]; keywords: string[] }) => Boolean(c.id && c.label)
    )
}

function normalizeInsight(raw: any): Insight {
  const summary = typeof raw?.summary === 'string' ? raw.summary : ''
  const next_steps = Array.isArray(raw?.next_steps) ? raw.next_steps.map((s: any) => String(s)) : []
  const titles = Array.isArray(raw?.titles) ? raw.titles.map((s: any) => String(s)) : []
  if (!summary && !next_steps.length && !titles.length) {
    throw new Error('インサイト結果の形式が正しくありません。AIの応答を確認してください。')
  }
  return { summary, next_steps, titles }
}

export async function clusterize(
  frags: { id: string; text: string; tags: string[] }[],
  previousClusters: PreviousClusterHint[] = []
): Promise<ClusterResult> {
  const sample = frags.slice(-200).map(f => ({ id: f.id, text: f.text, tags: f.tags }))
  const system =
    '与えられたメモ群を3〜8クラスタに分類し、各クラスタを{"id":"","label":"","memberIds":[],"keywords":[]}配列で返す。' +
    '既存クラスタが与えられた場合は出来る限り活かしつつ新規断片を統合し、全クラスタを返してください。'
  const user = {
    fragments: sample,
    existing_clusters: previousClusters.map(c => ({
      id: c.id,
      label: c.label,
      memberIds: c.memberIds.slice(0, 200),
      keywords: c.keywords?.slice(0, 20) || []
    }))
  }
  const raw = await openaiJson(system, user)
  return normalizeClusterResult(raw)
}

export async function insightForCluster(texts: string[], previous?: PreviousInsight): Promise<Insight> {
  const trimmed = texts.slice(-200)
  const system = previous
    ? '新しい短文群を既存の要約に統合し、{"summary":"","next_steps":[],"titles":[]}形式で返す。過去の要約内容を踏まえて全体像を更新してください。'
    : '短文群を要約し、{"summary":"","next_steps":[],"titles":[]}形式で返す。'
  const user = previous
    ? {
        new_items: trimmed,
        previous_insight: {
          summary: previous.summary,
          next_steps: previous.next_steps,
          titles: previous.titles,
          item_count: previous.item_count
        }
      }
    : { items: trimmed }
  const raw = await openaiJson(system, user)
  return normalizeInsight(raw)
}
