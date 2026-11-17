import React from 'react'
import { useApp } from '../App.jsx'

export default function Navbar({ route, me, onLogout }) {
  const { t, lang, setLang, dark, setDark, nav } = useApp()
  const links = [
    ['/', t.nav.home], ['/prices', t.nav.prices], ['/agronom', t.nav.agronom],
    ['/bazaar', t.nav.bazaar], ['/coop', t.nav.coop],
  ]
  const active = (r) => route === r
  return (
    <header className="sticky top-0 z-40 backdrop-blur-lg border-b" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
        <button onClick={() => nav('/')} className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🍑</span>
          <span className="font-extrabold text-lg tracking-tight">
            <span className="text-oruk-500">Örük</span>.AI
          </span>
        </button>
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {links.map(([r, label]) => (
            <button key={r} onClick={() => nav(r)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${active(r) ? 'bg-oruk-500 text-white shadow-soft' : 'muted hover:opacity-80 hover:bg-oruk-500/10'}`}>
              {label}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <button onClick={() => setLang(lang === 'ru' ? 'kg' : 'ru')}
          className="px-2.5 py-1.5 rounded-full text-xs font-bold border hover:bg-oruk-500/10" style={{ borderColor: 'var(--border)' }}>
          {lang === 'ru' ? 'KG' : 'RU'}
        </button>
        <button onClick={() => setDark(!dark)} aria-label="theme"
          className="px-2.5 py-1.5 rounded-full text-xs border hover:bg-oruk-500/10" style={{ borderColor: 'var(--border)' }}>
          {dark ? '☀️' : '🌙'}
        </button>
        {me ? (
          <div className="flex items-center gap-2">
            <button onClick={() => nav('/profile')} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-oruk-500/10 text-oruk-600 dark:text-oruk-300">
              <span>{me.role === 'farmer' ? '🌾' : me.role === 'buyer' ? '🛒' : '🛡️'}</span>
              <span className="max-w-28 truncate">{me.full_name}</span>
            </button>
            <button onClick={onLogout} className="text-sm muted hover:text-oruk-500">{t.nav.logout}</button>
          </div>
        ) : (
          <button onClick={() => nav('/login')} className="px-4 py-2 rounded-full text-sm font-semibold bg-oruk-500 hover:bg-oruk-600 text-white shadow-soft transition">
            {t.nav.login}
          </button>
        )}
      </div>
      <nav className="md:hidden flex gap-1 px-3 pb-2 overflow-x-auto">
        {links.map(([r, label]) => (
          <button key={r} onClick={() => nav(r)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${active(r) ? 'bg-oruk-500 text-white' : 'muted border'}`} style={active(r) ? {} : { borderColor: 'var(--border)' }}>
            {label}
          </button>
        ))}
      </nav>
    </header>
  )
}
