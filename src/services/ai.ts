const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
const OPENAI_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4o-mini'

type TagResult = { tags: string[]; confidence: number }
type ClusterResult = { id: string; label: string; memberIds: string[]; keywords: string[] }[]
type Insight = { summary: string; next_steps: string[]; titles: string[] }

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

export async function clusterize(frags: { id: string; text: string; tags: string[] }[]): Promise<ClusterResult> {
  const sample = frags.slice(-200).map(f => ({ id: f.id, text: f.text, tags: f.tags }))
  const system = '与えられたメモ群を3〜8クラスタに分類し、各クラスタを{"id":"","label":"","memberIds":[],"keywords":[]}配列で返す。'
  const user = { fragments: sample }
  return await openaiJson(system, user)
}

export async function insightForCluster(texts: string[]): Promise<Insight> {
  const system = '短文群を要約し、{"summary":"","next_steps":[],"titles":[]}形式で返す。'
  const user = { items: texts.slice(0, 200) }
  return await openaiJson(system, user)
}
