import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, IdeaFragment } from '../db/db'
import { insightForCluster } from '../services/ai'
import { jsPDF } from 'jspdf'

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

  async function exportJson() {
    try {
      setError(null)
      const latestRows = await refreshRows()
      if (!latestRows.length) {
        setError('エクスポートできるデータがありません。')
        return
      }
      const blob = new Blob(['\ufeff', JSON.stringify(latestRows, null, 2)], {
        type: 'application/json;charset=utf-8'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ideacloud-export-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      setError('JSONエクスポートに失敗しました。')
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

  async function exportPdf() {
    try {
      setError(null)
      const latestRows = await refreshRows()
      if (!latestRows.length) {
        setError('エクスポートできるデータがありません。')
        return
      }

      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 40
      const contentWidth = pageWidth - margin * 2
      const sections: HTMLCanvasElement[] = []

      sections.push(createHeaderSection(contentWidth, latestRows))

      if (ins) {
        sections.push(
          createParagraphSection(contentWidth, '要約', ins.summary, {
            fallback: '要約がまだ生成されていません。'
          })
        )
        sections.push(createListSection(contentWidth, '次の一手', ins.next_steps, '提案はまだありません。'))
        sections.push(createListSection(contentWidth, 'タイトル候補', ins.titles, 'タイトル案はまだありません。'))
      } else {
        sections.push(
          createParagraphSection(
            contentWidth,
            'インサイト',
            'まだインサイトが生成されていません。上のボタンから生成を開始してください。'
          )
        )
      }

      let cursorY = margin
      sections.forEach(canvas => {
        const imgData = canvas.toDataURL('image/png')
        const imgHeight = (canvas.height / canvas.width) * contentWidth
        if (cursorY + imgHeight > pageHeight - margin) {
          doc.addPage()
          cursorY = margin
        }
        doc.addImage(imgData, 'PNG', margin, cursorY, contentWidth, imgHeight, undefined, 'FAST')
        cursorY += imgHeight + 16
      })

      doc.save(`ideacloud-insight-${Date.now()}.pdf`)
    } catch (err) {
      console.error(err)
      setError('PDF出力に失敗しました。ブラウザがCanvas描画に対応しているか確認してください。')
    }
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
              AIが要約・次のアクション・タイトル案を提案します。データをエクスポートして他のツールと連携することもできます。
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
            <button
              onClick={() => void exportJson()}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:text-white"
            >
              JSONエクスポート
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-white/20 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:text-white">
              JSONインポート
              <input type="file" accept="application/json" onChange={importJson} className="hidden" />
            </label>
            <button
              onClick={() => void exportPdf()}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/60 hover:text-white"
            >
              PDF出力
            </button>
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

const CANVAS_DPI = 2
const FONT_FAMILY = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "MS PGothic", sans-serif'

function createHeaderSection(width: number, rows: IdeaFragment[]) {
  const canvasWidth = Math.round(width * CANVAS_DPI)
  const paddingX = 28 * CANVAS_DPI
  const paddingY = 32 * CANVAS_DPI
  const titleSize = 26 * CANVAS_DPI
  const subtitleSize = 12 * CANVAS_DPI
  const statLabelSize = 11 * CANVAS_DPI
  const statValueSize = 20 * CANVAS_DPI
  const statGap = 24 * CANVAS_DPI
  const canvasHeight = paddingY * 2 + titleSize + subtitleSize + statValueSize + 60 * CANVAS_DPI
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D contextが利用できません。')

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  setCanvasFont(ctx, titleSize, 'bold')
  ctx.fillStyle = '#e2e8f0'
  let cursorY = paddingY + titleSize
  ctx.fillText('IdeaCloud Insight', paddingX, cursorY)

  setCanvasFont(ctx, subtitleSize, 'normal')
  ctx.fillStyle = 'rgba(226, 232, 240, 0.8)'
  cursorY += subtitleSize + 16 * CANVAS_DPI
  ctx.fillText(new Date().toLocaleString('ja-JP'), paddingX, cursorY)

  const stats = [
    { label: '断片総数', value: rows.length },
    {
      label: '保存済みクラスタ',
      value: new Set(rows.map(r => r.clusterId).filter(Boolean)).size
    },
    {
      label: 'タグ多様性',
      value: new Set(rows.flatMap(r => r.tags || [])).size
    }
  ]

  const statWidth = (canvasWidth - paddingX * 2 - statGap * (stats.length - 1)) / stats.length
  cursorY += 30 * CANVAS_DPI

  stats.forEach((stat, index) => {
    const x = paddingX + index * (statWidth + statGap)
    ctx.fillStyle = 'rgba(148, 163, 184, 0.75)'
    setCanvasFont(ctx, statLabelSize, 'normal')
    ctx.fillText(stat.label, x, cursorY)
    setCanvasFont(ctx, statValueSize, 'bold')
    ctx.fillStyle = '#f8fafc'
    ctx.fillText(String(stat.value), x, cursorY + 28 * CANVAS_DPI)
  })

  return canvas
}

function createParagraphSection(
  width: number,
  title: string,
  text: string,
  options?: { fallback?: string }
) {
  const canvasWidth = Math.round(width * CANVAS_DPI)
  const paddingX = 28 * CANVAS_DPI
  const paddingY = 28 * CANVAS_DPI
  const titleSize = 20 * CANVAS_DPI
  const bodySize = 14 * CANVAS_DPI
  const lineHeight = Math.round(bodySize * 1.6)
  const contentWidth = canvasWidth - paddingX * 2
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas 2D contextが利用できません。')

  const sourceText = text && text.trim().length ? text : options?.fallback ?? ''
  const lines = wrapCanvasText(sourceText, contentWidth, bodySize, measure)
  const canvasHeight = paddingY * 2 + titleSize + 16 * CANVAS_DPI + Math.max(lineHeight, lines.length * lineHeight)
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D contextが利用できません。')

  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  setCanvasFont(ctx, titleSize, 'bold')
  ctx.fillStyle = '#0f172a'
  let cursorY = paddingY + titleSize
  ctx.fillText(title, paddingX, cursorY)

  setCanvasFont(ctx, bodySize, 'normal')
  ctx.fillStyle = '#1e293b'
  cursorY += 16 * CANVAS_DPI

  if (!lines.length) {
    ctx.fillText('内容がありません。', paddingX, cursorY + lineHeight)
  } else {
    lines.forEach(line => {
      if (!line) {
        cursorY += lineHeight
      } else {
        cursorY += lineHeight
        ctx.fillText(line, paddingX, cursorY)
      }
    })
  }

  return canvas
}

function createListSection(width: number, title: string, items: string[], emptyMessage: string) {
  if (!items.length) {
    return createParagraphSection(width, title, emptyMessage)
  }

  const canvasWidth = Math.round(width * CANVAS_DPI)
  const paddingX = 28 * CANVAS_DPI
  const paddingY = 28 * CANVAS_DPI
  const titleSize = 18 * CANVAS_DPI
  const bodySize = 14 * CANVAS_DPI
  const lineHeight = Math.round(bodySize * 1.6)
  const bulletIndent = 20 * CANVAS_DPI
  const contentWidth = canvasWidth - paddingX * 2 - bulletIndent
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas 2D contextが利用できません。')

  const wrappedLines: { text: string; indent: number }[] = []
  items.forEach((item, itemIndex) => {
    const segments = wrapCanvasText(item, contentWidth, bodySize, measure)
    segments.forEach((segment, segmentIndex) => {
      if (!segment) {
        wrappedLines.push({ text: '', indent: 0 })
        return
      }
      if (segmentIndex === 0) {
        wrappedLines.push({ text: `・ ${segment}`, indent: 0 })
      } else {
        wrappedLines.push({ text: segment, indent: bulletIndent })
      }
    })
    if (itemIndex < items.length - 1) {
      wrappedLines.push({ text: '', indent: 0 })
    }
  })

  const lineCount = wrappedLines.length || 1
  const canvasHeight = paddingY * 2 + titleSize + 16 * CANVAS_DPI + lineCount * lineHeight
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D contextが利用できません。')

  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  setCanvasFont(ctx, titleSize, 'bold')
  ctx.fillStyle = '#0f172a'
  let cursorY = paddingY + titleSize
  ctx.fillText(title, paddingX, cursorY)

  setCanvasFont(ctx, bodySize, 'normal')
  ctx.fillStyle = '#1e293b'
  cursorY += 16 * CANVAS_DPI

  wrappedLines.forEach(line => {
    cursorY += lineHeight
    if (!line.text) return
    ctx.fillText(line.text, paddingX + line.indent, cursorY)
  })

  return canvas
}

function wrapCanvasText(
  text: string,
  maxWidth: number,
  fontSize: number,
  ctx: CanvasRenderingContext2D
) {
  const result: string[] = []
  setCanvasFont(ctx, fontSize, 'normal')
  const paragraphs = text.split(/\r?\n/)
  paragraphs.forEach((paragraph, index) => {
    if (!paragraph.trim()) {
      if (result.length) result.push('')
      return
    }
    let current = ''
    for (const ch of paragraph) {
      const next = current + ch
      if (ctx.measureText(next).width > maxWidth && current) {
        result.push(current)
        current = ch
      } else {
        current = next
      }
    }
    if (current) {
      result.push(current)
    }
    if (index < paragraphs.length - 1) {
      result.push('')
    }
  })
  return result
}

function setCanvasFont(ctx: CanvasRenderingContext2D, size: number, weight: 'normal' | 'bold') {
  const numericWeight = weight === 'bold' ? 600 : 400
  ctx.font = `${numericWeight} ${size}px ${FONT_FAMILY}`
  ctx.textBaseline = 'alphabetic'
}
