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
      setBusy(true); setError(null)
      const items = await db.fragments.toArray()
      const out = await clusterize(items.map(f => ({ id: f.id, text: f.text, tags: f.tags || [] })))
      await db.clusters.clear()
      const toInsert: CloudCluster[] = out.map(c => ({
        id: c.id, label: c.label, tagHints: c.keywords || [],
        fragmentIds: c.memberIds || [], score: 1
      }))
      await db.clusters.bulkAdd(toInsert)
      const map: Record<string, string> = {}
      out.forEach(c => c.memberIds.forEach(id => map[id] = c.id))
      await db.transaction('rw', db.fragments, async () => {
        for (const f of items) await db.fragments.update(f.id, { clusterId: map[f.id] })
      })
      await load()
      await render()
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function buildElements(frags: IdeaFragment[]): ElementsDefinition {
    const nodes = frags.map(f => ({ data: { id: f.id, label: f.text.slice(0, 28) || '…', clusterId: f.clusterId || 'none' } }))
    const edges: any[] = [] // MVP: 関連は将来
    return { nodes, edges }
  }

  function nodeStyle(frags: IdeaFragment[]) {
    const ids = Array.from(new Set(frags.map(f => f.clusterId || 'none')))
    const palette = ['#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa','#f472b6','#22d3ee','#f59e0b','#84cc16']
    const colorBy: Record<string, string> = {}
    ids.forEach((id, i) => colorBy[id] = palette[i % palette.length])
    return {
      label: 'data(label)',
      'font-size': 10,
      'text-wrap': 'wrap',
      width: 10, height: 10,
      'background-color': (ele: any) => colorBy[ele.data('clusterId')] || '#94a3b8'
    } as any
  }

  async function render() {
    const cy = cytoscape({
      container: ref.current!,
      elements: buildElements(frags),
      layout: { name: 'cose' },
      style: [
        { selector: 'node', style: nodeStyle(frags) },
        { selector: 'edge', style: { width: 1 } }
      ]
    })
    setReady(true)
    return () => cy.destroy()
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (frags.length) render() }, [frags])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={recalcClusters} disabled={busy} className="px-3 py-2 border rounded">
          {busy ? '再計算中…' : 'クラスタ再計算'}
        </button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </div>
      <div className="h-[70vh] border rounded" ref={ref}>
        {!ready && <div className="p-2 text-sm">読み込み中...</div>}
      </div>
    </div>
  )
}
