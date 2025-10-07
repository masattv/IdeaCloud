import { useEffect, useRef, useState } from 'react'
import cytoscape, { ElementsDefinition } from 'cytoscape'
import { db, IdeaFragment, CloudCluster } from '../db/db'
import { clusterize } from '../services/ai'

export default function MapView() {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [clusters, setClusters] = useState<CloudCluster[]>([])
  const [frags, setFrags] = useState<IdeaFragment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setFrags(await db.fragments.toArray())
    setClusters(await db.clusters.toArray())
  }

  async function recalcClusters() {
    try {
      setBusy(true)
      setError(null)
      const items = await db.fragments.toArray()
      const existingClusters = await db.clusters.toArray()
      const hasNewFragments = items.some(f => !f.clusterId)
      if (!hasNewFragments && existingClusters.length) {
        setError('新しい断片がないため再計算をスキップしました。')
        return
      }
      const out = await clusterize(
        items.map(f => ({ id: f.id, text: f.text, tags: f.tags || [] })),
        existingClusters.map(c => ({
          id: c.id,
          label: c.label,
          memberIds: c.fragmentIds,
          keywords: c.tagHints
        }))
      )
      await db.clusters.clear()
      const toInsert: CloudCluster[] = out.map(c => ({
        id: c.id,
        label: c.label,
        tagHints: c.keywords || [],
        fragmentIds: c.memberIds || [],
        score: 1
      }))
      await db.clusters.bulkAdd(toInsert)
      const map: Record<string, string> = {}
      out.forEach(c => c.memberIds.forEach(id => (map[id] = c.id)))
      await db.transaction('rw', db.fragments, async () => {
        for (const f of items) await db.fragments.update(f.id, { clusterId: map[f.id] })
      })
      await load()
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function buildElements(list: IdeaFragment[]): ElementsDefinition {
    const nodes = list.map(f => {
      const trimmed = (f.text || '').trim()
      const label = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed || '…'
      return {
        data: { id: f.id, label, clusterId: f.clusterId || 'none' }
      }
    })
    const edges: any[] = [] // MVP: 関連は将来
    return { nodes, edges }
  }

  function nodeStyle(list: IdeaFragment[]) {
    const ids = Array.from(new Set(list.map(f => f.clusterId || 'none')))
    const palette = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a855f7', '#fb7185', '#22d3ee', '#f97316', '#84cc16']
    const colorBy: Record<string, string> = {}
    ids.forEach((id, i) => (colorBy[id] = palette[i % palette.length]))
    return {
      label: 'data(label)',
      'font-size': 13,
      'font-family': '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
      'text-wrap': 'wrap',
      'text-max-width': '140px',
      'text-valign': 'top',
      'text-halign': 'center',
      'text-margin-y': -14,
      'text-background-color': 'rgba(15,23,42,0.75)',
      'text-background-shape': 'roundrectangle',
      'text-background-opacity': 0.85,
      width: 16,
      height: 16,
      'border-width': 2,
      'border-color': 'rgba(15,118,110,0.6)',
      'background-color': (ele: any) => colorBy[ele.data('clusterId')] || '#94a3b8',
      color: '#e2e8f0',
      'font-weight': '600',
      'text-outline-color': 'rgba(15,23,42,0.7)',
      'text-outline-width': 2
    } as any
  }

  function render() {
    const cy = cytoscape({
      container: ref.current!,
      elements: buildElements(frags),
      layout: { name: 'cose', animate: true, idealEdgeLength: 120, nodeRepulsion: 8000 },
      style: [
        { selector: 'node', style: nodeStyle(frags) },
        { selector: 'edge', style: { width: 1.5, 'line-color': 'rgba(148,163,184,0.35)' } }
      ]
    })
    setReady(true)
    return () => cy.destroy()
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!frags.length || !ref.current) return
    const cleanup = render()
    return cleanup
  }, [frags])

  const stats = [
    { label: '断片', value: frags.length },
    { label: 'クラスタ', value: clusters.length },
    {
      label: 'タグ多様性',
      value: new Set(frags.flatMap(f => f.tags || [])).size
    }
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">アイデアクラウドマップ</h2>
          <p className="max-w-2xl text-sm text-slate-300">
            断片どうしの近さからパターンを発見しましょう。クラスタ再計算でAIが新しい関連性を提案します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={recalcClusters}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:from-emerald-300 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? '再計算中…' : 'クラスタを再計算'}
          </button>
          {error && <div className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs text-red-200">{error}</div>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-center shadow-inner shadow-cyan-500/10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200/70">{stat.label}</div>
            <div className="mt-2 text-2xl font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-[0_25px_60px_-35px_rgba(14,165,233,0.7)]">
        <div ref={ref} className="h-[70vh]" />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            読み込み中...
          </div>
        )}
      </div>
    </div>
  )
}
