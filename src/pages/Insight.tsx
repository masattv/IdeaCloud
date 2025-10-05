import { useEffect, useState } from 'react'
import { db, IdeaFragment } from '../db/db'
import { insightForCluster } from '../services/ai'
import { jsPDF } from 'jspdf'

export default function Insight() {
  const [rows, setRows] = useState<IdeaFragment[]>([])
  const [ins, setIns] = useState<{summary:string, next_steps:string[], titles:string[]}>()

  useEffect(() => { db.fragments.toArray().then(setRows) }, [])

  async function genInsight() {
    const texts = rows.map(r => r.text)
    setIns(await insightForCluster(texts))
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `ideacloud-export-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  async function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    const arr = JSON.parse(text) as IdeaFragment[]
    await db.transaction('rw', db.fragments, async () => {
      for (const f of arr) await db.fragments.put(f)
    })
    setRows(await db.fragments.toArray())
    e.target.value = ''
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    let y = 40
    doc.setFontSize(16); doc.text('IdeaCloud Insight', 40, y); y += 24
    doc.setFontSize(12)
    if (ins) {
      doc.text('要約:', 40, y); y += 18
      y = wrapText(doc, ins.summary, 40, y, 520) + 10
      doc.text('次の一手:', 40, y); y += 18
      ins.next_steps.forEach(s => { y = wrapText(doc, '・' + s, 50, y, 510) + 8 })
      y += 8
      doc.text('タイトル候補:', 40, y); y += 18
      ins.titles.forEach(t => { y = wrapText(doc, '・' + t, 50, y, 510) + 8 })
    } else {
      doc.text('まだインサイトが生成されていません。', 40, y)
    }
    doc.save(`ideacloud-insight-${Date.now()}.pdf`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={genInsight} className="px-3 py-2 border rounded">インサイト生成</button>
        <button onClick={exportJson} className="px-3 py-2 border rounded">JSONエクスポート</button>
        <label className="px-3 py-2 border rounded cursor-pointer">
          JSONインポート<input type="file" accept="application/json" onChange={importJson} className="hidden" />
        </label>
        <button onClick={exportPdf} className="px-3 py-2 border rounded">PDF出力</button>
      </div>

      <div className="p-3 border rounded">
        <div>断片総数: <b>{rows.length}</b></div>
      </div>

      {ins && (
        <div className="p-3 border rounded space-y-2">
          <div className="font-semibold">今週の要約</div>
          <p>{ins.summary}</p>
          <div className="font-semibold">次の一手</div>
          <ul className="list-disc pl-6">
            {ins.next_steps.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <div className="font-semibold">タイトル候補</div>
          <ul className="list-disc pl-6">
            {ins.titles.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, width: number) {
  const lines = doc.splitTextToSize(text, width)
  lines.forEach((line) => { doc.text(line, x, y); y += 14 })
  return y
}
