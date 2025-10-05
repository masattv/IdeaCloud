import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import './index.css'
import Capture from './pages/Capture'
import MapView from './pages/MapView'
import Insight from './pages/Insight'

function Layout() {
  function navClass({ isActive }: { isActive: boolean }) {
    return [
      'px-5 py-2.5 rounded-full text-sm font-semibold transition duration-200',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400',
      isActive
        ? 'bg-white text-slate-950 shadow-lg shadow-cyan-500/30'
        : 'text-slate-200 hover:text-white hover:bg-white/10'
    ].join(' ')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.25),_transparent_60%)]" />
        <div className="absolute inset-y-0 left-1/2 h-[120%] w-[120%] -translate-x-1/2 bg-[conic-gradient(at_top,_rgba(14,116,144,0.35),_rgba(79,70,229,0.15),_transparent_70%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-10 sm:px-10">
        <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300/80">IdeaCloud</div>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              アイデアをつないで、<span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400 bg-clip-text text-transparent">洞察</span>へ
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              断片を素早くキャプチャし、関係性を俯瞰しながら次の一手を導き出すモダンなナレッジワークスペースです。
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 p-2 shadow-inner shadow-cyan-500/10 backdrop-blur">
            <NavLink to="/" end className={navClass}>
              Capture
            </NavLink>
            <NavLink to="/map" className={navClass}>
              Map
            </NavLink>
            <NavLink to="/insight" className={navClass}>
              Insight
            </NavLink>
          </nav>
        </header>

        <main className="mt-10 flex-1">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-[0_30px_80px_-40px_rgba(14,116,144,0.8)] backdrop-blur">
            <Routes>
              <Route path="/" element={<Capture />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/insight" element={<Insight />} />
            </Routes>
          </div>
        </main>

        <footer className="mt-12 text-xs text-slate-400/80">
          © {new Date().getFullYear()} IdeaCloud. Crafted for creative builders.
        </footer>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  </React.StrictMode>,
)
