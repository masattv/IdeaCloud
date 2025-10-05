import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import './index.css'
import Capture from './pages/Capture'
import MapView from './pages/MapView'
import Insight from './pages/Insight'

function Layout() {
  return (
    <div className="min-h-screen max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">IdeaCloud</h1>
        <nav className="space-x-4">
          <NavLink to="/" end className={({isActive}) => isActive ? 'underline' : ''}>Capture</NavLink>
          <NavLink to="/map" className={({isActive}) => isActive ? 'underline' : ''}>Map</NavLink>
          <NavLink to="/insight" className={({isActive}) => isActive ? 'underline' : ''}>Insight</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Capture/>} />
        <Route path="/map" element={<MapView/>} />
        <Route path="/insight" element={<Insight/>} />
      </Routes>
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
