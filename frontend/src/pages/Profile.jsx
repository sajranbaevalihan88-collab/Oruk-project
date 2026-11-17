import React, { useEffect, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../api.js'

export default function Profile() {
  const { t, me, nav } = useApp()
  const tp = t.profile
  const [reports, setReports] = useState([])
  const [lots, setLots] = useState([])

  useEffect(() => {
    if (!me) { nav('/login'); return }
    Promise.all([api.get('/prices/latest'), api.get('/lots')]).then(([p, l]) => {
      setReports(p.reports.filter((r) => r.full_name === me.full_name).slice(0, 8))
      setLots(l.filter((x) => x.farmer_name === me.full_name))
    }).catch(() => {})
  }, [me])

  if (!me) return null
  const hint = me.role === 'farmer' ? tp.farmerHint : me.role === 'buyer' ? tp.buyerHint : tp.adminHint

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="card p-7 flex flex-wrap items-center gap-5">
        <div className="w-16 h-16 rounded-3xl grid place-items-center text-3xl bg-gradient-to-br from-oruk-400 to-oruk-600 text-white shadow-soft">
          {me.role === 'farmer' ? '🌾' : me.role === 'buyer' ? '🛒' : '🛡️'}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-black">{tp.welcome}, {me.full_name}!</h1>
          <div className="text-sm muted mt-1">{t.login.roles[me.role]} · 📍{me.region} {me.phone && `· 📞${me.phone}`} · @{me.username}</div>
          <div className="text-sm mt-2 text-oruk-500 font-medium">{hint}</div>
        </div>
        <button onClick={() => nav(me.role === 'buyer' ? '/bazaar' : me.role === 'admin' ? '/coop' : '/prices')}
          className="px-5 py-2.5 rounded-full font-semibold text-white bg-oruk-500 hover:bg-oruk-600 shadow-soft">
          {me.role === 'buyer' ? `→ ${t.bazaar.title}` : me.role === 'admin' ? `→ ${t.coop.title}` : `→ ${t.prices.report}`}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold" style={{ borderColor: 'var(--border)' }}>📋 {tp.myReports}</div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {reports.length ? reports.map((r) => (
              <div key={r.id} className="px-5 py-3 flex justify-between text-sm">
                <span>{r.name_ru} · {r.region}</span>
                <span className="font-bold text-oruk-500">{r.price_som} {t.common.som}</span>
              </div>
            )) : <div className="px-5 py-6 text-sm muted text-center">—</div>}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold" style={{ borderColor: 'var(--border)' }}>📦 {tp.myLots}</div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {lots.length ? lots.map((l) => (
              <div key={l.id} className="px-5 py-3 flex justify-between text-sm">
                <span>{l.name_ru} · {l.quantity_kg} {t.common.kg} · {l.region}</span>
                <span className="font-bold text-oruk-500">{l.price_som} {t.common.som}</span>
              </div>
            )) : <div className="px-5 py-6 text-sm muted text-center">—</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
