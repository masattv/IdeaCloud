import { useEffect, useMemo, useState } from 'react'
import { db, IdeaFragment } from '../db/db'
import { v4 as uuid } from 'uuid'
import { tagIdea } from '../services/ai'

const STAR_LABELS = ['ひらめきの種', '少し気になる', '注目アイデア', '最優先メモ']

export default function Capture() {
  const [text, setText] = useState('')
  const [star, setStar] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const starLabel = useMemo(() => STAR_LABELS[star] ?? STAR_LABELS[0], [star])

  async function onSubmit() {
    try {
      const id = uuid()
      const now = new Date().toISOString()
      const { tags } = await tagIdea(text)
      const frag: IdeaFragment = { id, text, createdAt: now, star, tags, rel: [] }
      await db.fragments.add(frag)
      setText('')
      setStar(0)
      setToast(`保存しました: ${tags.join(', ')}`)
      setTimeout(() => setToast(null), 1800)
      setError(null)
    } catch (e: any) {
      setError(e.message || String(e))
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.trim()) onSubmit()
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 shadow-[0_25px_60px_-30px_rgba(8,145,178,0.7)]">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cyan-400/30 blur-3xl" />
          <div className="relative space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">アイデアの断片をキャプチャ</h2>
              <p className="mt-2 text-sm text-slate-300">
                思いついた瞬間に書き留めましょう。Enterで即保存、Shift + Enterで改行できます。
              </p>
            </div>
            <div className="space-y-3">
              <label className="font-heading block text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">fragment</label>
              <textarea
                className="min-h-[160px] w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-base text-slate-100 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                rows={4}
                placeholder="一行メモ（断片）を入力..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-heading text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/70">priority</div>
                <div className="mt-1 text-sm text-slate-200">{starLabel}</div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center justify-between gap-3 text-base font-medium text-amber-300">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span key={i} className={i <= star ? 'text-amber-300' : 'text-slate-500'}>
                      ★
                    </span>
                  ))}
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  value={star}
                  onChange={e => setStar(parseInt(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-400"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-xs text-slate-400">
                <p>Shift + Enter で改行。AIがタグを自動提案します。</p>
                {error && <p className="text-red-400">{error}</p>}
              </div>
              <button
                onClick={onSubmit}
                disabled={!text.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-6 py-3 text-sm font-heading font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                保存してタグ付け
              </button>
            </div>
          </div>
        </div>
        {toast && (
          <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200 shadow-inner shadow-cyan-500/20">
            {toast}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <RecentList />
      </aside>
    </div>
  )
}

function RecentList() {
  const [list, setList] = useState<IdeaFragment[]>([])

  useEffect(() => {
    const load = async () => setList(await db.fragments.orderBy('createdAt').reverse().limit(10).toArray())
    load()
    const id = setInterval(load, 1200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-3xl border border-white/5 bg-white/5 p-5 shadow-[0_20px_40px_-30px_rgba(14,165,233,0.7)]">
      <h2 className="text-base font-semibold text-white">最近の断片</h2>
      <p className="mt-1 text-xs text-slate-300">最新10件のメモがタイムラインで表示されます。</p>
      <ul className="mt-4 space-y-3">
        {list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-4 text-sm text-slate-400">
            まだ保存された断片がありません。最初のひらめきを記録しましょう。
          </li>
        )}
        {list.map(f => (
          <li
            key={f.id}
            className="group rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-cyan-300/60 hover:bg-slate-900/80"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{new Date(f.createdAt).toLocaleString()}</span>
              <span className="font-heading rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                {f.star + 1} ★
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-100">{f.text}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-cyan-200">
              {f.tags.map(tag => (
                <span key={tag} className="rounded-full bg-cyan-500/10 px-2 py-0.5">
                  #{tag}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
