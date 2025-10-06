import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, IdeaFragment } from '../db/db'
import { insightForCluster } from '../services/ai'

type InsightPayload = { summary: string; next_steps: string[]; titles: string[] }

export default function Insight() {
  const [rows, setRows] = useState<IdeaFragment[]>([])
  const [ins, setIns] = useState<InsightPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshRows = useCallback(async () => {
    const latest = await db.fragments.orderBy('createdAt').toArray()
    setRows(latest)
    return latest
  }, [])

  useEffect(() => {
    void refreshRows()
  }, [refreshRows])

  async function genInsight() {
    try {
      setError(null)
      setLoading(true)
      const latestRows = await refreshRows()
      if (!latestRows.length) {
        setIns(null)
        setError('分析するメモがありません。まずはキャプチャから断片を追加してください。')
        return
      }
      const texts = latestRows.map(r => r.text).filter(Boolean)
      if (!texts.length) {
        setIns(null)
        setError('テキストの内容が空です。メモの内容を確認してください。')
        return
      }
      const result = await insightForCluster(texts)
      setIns(result)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'インサイトの生成に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  async function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const arr = JSON.parse(text) as IdeaFragment[]
    setError(null)
    await db.transaction('rw', db.fragments, async () => {
      for (const f of arr) await db.fragments.put(f)
    })
    await refreshRows()
    e.target.value = ''
  }

  const statCards = useMemo(
    () => [
      { label: '断片総数', value: rows.length },
      { label: '保存済みクラスタ', value: new Set(rows.map(r => r.clusterId).filter(Boolean)).size },
      { label: 'タグ多様性', value: new Set(rows.flatMap(r => r.tags || [])).size }
    ],
    [rows]
  )

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_60px_-30px_rgba(59,130,246,0.6)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">インサイトダッシュボード</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              AIが要約・次のアクション・タイトル案を提案します。結果はダッシュボード上でいつでも確認できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={genInsight}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-indigo-500/30 transition hover:from-sky-300 hover:to-purple-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? '生成中…' : 'インサイトを生成'}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-white/20 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:text-white">
              JSONインポート
              <input type="file" accept="application/json" onChange={importJson} className="hidden" />
            </label>
          </div>
          {error && (
            <p className="text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {statCards.map(card => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-inner shadow-sky-500/10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200/70">{card.label}</div>
            <div className="mt-2 text-2xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_20px_50px_-35px_rgba(236,72,153,0.5)]">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-300">まずは断片を追加して、洞察の材料をためましょう。</div>
        ) : ins ? (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white">今週の要約</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">{ins.summary}</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/80">次の一手</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {ins.next_steps.map((s, i) => (
                    <li key={i} className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-300/80">タイトル候補</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {ins.titles.map((s, i) => (
                    <li key={i} className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-2">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <p>まだインサイトが生成されていません。上のボタンから生成を開始しましょう。</p>
            {loading && <p className="text-cyan-200">AIが分析中です…</p>}
          </div>
        )}
      </section>
    </div>
  )
}
