import { useEffect, useState } from 'react'
import { db, IdeaFragment } from '../db/db'
import { v4 as uuid } from 'uuid'
import { tagIdea } from '../services/ai'

export default function Capture() {
  const [text, setText] = useState('')
  const [star, setStar] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    try {
      const id = uuid()
      const now = new Date().toISOString()
      const { tags } = await tagIdea(text)
      const frag: IdeaFragment = { id, text, createdAt: now, star, tags, rel: [] }
      await db.fragments.add(frag)
      setText(''); setStar(0)
      setToast(`保存しました: ${tags.join(', ')}`)
      setTimeout(() => setToast(null), 1500)
    } catch (e: any) {
      setError(e.message || String(e))
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) onSubmit() }
  }

  return (
    <div className="space-y-4">
      <textarea className="w-full p-3 border rounded" rows={3}
        placeholder="一行メモ（断片）を入力..." value={text}
        onChange={e => setText(e.target.value)} onKeyDown={onKeyDown}/>
      <div className="flex items-center gap-3">
        <label>重要度:</label>
        <input type="range" min={0} max={3} value={star} onChange={e => setStar(parseInt(e.target.value))} />
        <button onClick={onSubmit} disabled={!text.trim()} className="px-3 py-2 border rounded">保存</button>
      </div>
      {toast && <div className="text-sm">{toast}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <RecentList/>
    </div>
  )
}

function RecentList() {
  const [list, setList] = useState<IdeaFragment[]>([])
  useEffect(() => {
    const load = async () => setList(await db.fragments.orderBy('createdAt').reverse().limit(10).toArray())
    load(); const id = setInterval(load, 1000); return () => clearInterval(id)
  }, [])
  return (
    <div className="mt-6">
      <h2 className="font-semibold mb-2">最近の断片</h2>
      <ul className="space-y-2">{list.map(f => (
        <li key={f.id} className="p-2 border rounded">
          <div className="text-sm opacity-70">{new Date(f.createdAt).toLocaleString()}</div>
          <div>{f.text}</div>
          <div className="text-xs opacity-70">tags: {f.tags.join(', ')}</div>
        </li>
      ))}</ul>
    </div>
  )
}
