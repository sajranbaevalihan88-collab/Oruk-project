import React, { useEffect, useState } from 'react'
import { useApp } from '../App.jsx'
import LineChart from '../components/LineChart.jsx'
import { api } from '../api.js'

export default function Home() {
  const { t, nav } = useApp()
  const [stats, setStats] = useState(null)
  const [series, setSeries] = useState(null)

  useEffect(() => {
    api.get('/stats').then(setStats).catch(() => {})
    api.get('/products').then(async (ps) => {
      const apricot = ps.find((p) => p.name_ru === 'Абрикос свежий')
      if (apricot) {
        const h = await api.get(`/prices/history?product_id=${apricot.id}&region=Баткен`)
        setSeries(h.series)
      }
    }).catch(() => {})
  }, [])

  const stat = (label, value, emoji) => (
    <div className="card p-5 flex items-center gap-4">
      <div className="text-3xl">{emoji}</div>
      <div>
        <div className="text-2xl font-extrabold text-oruk-500">{value ?? '—'}</div>
        <div className="text-xs muted">{label}</div>
      </div>
    </div>
  )

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-70"
          style={{ background: 'radial-gradient(1000px 420px at 15% -10%, rgba(249,115,22,.25), transparent 60%), radial-gradient(800px 380px at 85% 0%, rgba(34,197,94,.16), transparent 60%)' }} />
        <div className="max-w-6xl mx-auto px-4 pt-14 pb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-oruk-500/10 text-oruk-600 dark:text-oruk-300 border border-oruk-500/20">
            🏆 {t.hero.badge}
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-black leading-[1.05] tracking-tight max-w-3xl">
            {t.hero.title1}<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-oruk-500 to-leaf-500">{t.hero.title2}</span>
          </h1>
          <p className="mt-5 text-lg muted max-w-2xl">{t.hero.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => nav('/prices')} className="px-6 py-3 rounded-full font-semibold text-white bg-oruk-500 hover:bg-oruk-600 shadow-soft transition">
              📊 {t.hero.cta1}
            </button>
            <button onClick={() => nav('/agronom')} className="px-6 py-3 rounded-full font-semibold border-2 border-oruk-500 text-oruk-500 hover:bg-oruk-500/10 transition">
              🤖 {t.hero.cta2}
            </button>
          </div>

          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stat(t.hero.stat1, stats?.reports, '📋')}
            {stat(t.hero.stat2, stats?.farmers, '🌾')}
            {stat(t.hero.stat3, stats?.active_lots, '📦')}
            {stat(t.hero.stat4, stats?.kg_traded?.toLocaleString?.(), '🚚')}
          </div>
        </div>
      </section>

      {/* COLLAPSE CHART */}
      <section className="max-w-6xl mx-auto px-4 pb-6">
        <div className="card p-6 md:p-8 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">{t.hero.collapseTitle}</h2>
              <p className="text-sm muted mt-1">{t.hero.collapseNote}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/15 text-leaf-600">250 {t.common.som}</span>
              <span className="muted">→</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-500 animate-pulse">25 {t.common.som}</span>
            </div>
          </div>
          <div className="mt-4">
            <LineChart data={series || []} warnLast height={300} />
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold mb-6">{t.hero.whyTitle}</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            ['⚖️', t.hero.why1t, t.hero.why1d],
            ['🫥', t.hero.why2t, t.hero.why2d],
            ['🔗', t.hero.why3t, t.hero.why3d],
          ].map(([e, tt, d]) => (
            <div key={tt} className="card p-6 hover:-translate-y-1 hover:shadow-soft transition">
              <div className="text-3xl">{e}</div>
              <h3 className="mt-3 font-bold text-lg">{tt}</h3>
              <p className="mt-2 text-sm muted leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
