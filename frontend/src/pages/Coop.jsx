import React, { useEffect, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../api.js'

export default function Coop({ products }) {
  const { t, lang, me } = useApp()
  const tc = t.coop
  const [list, setList] = useState([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [pledgeFor, setPledgeFor] = useState(null)
  const [pledgeKg, setPledgeKg] = useState('')
  const [form, setForm] = useState({ product_id: '', title: '', target_kg: '', min_price_som: '', deadline: '' })

  const load = () => api.get('/coop').then(setList).catch(() => {})
  useEffect(load, [])

  const pname = (id) => {
    const p = products.find((x) => x.id === id)
    return p ? (lang === 'kg' ? p.name_kg : p.name_ru) : ''
  }

  const submitPledge = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    try {
      const r = await api.post(`/coop/${pledgeFor}/pledge`, { pledged_kg: +pledgeKg })
      setPledgeFor(null); setPledgeKg('')
      setMsg(`${tc.pledged}: ${Math.round(r.pledged_kg)} / ${r.target_kg} ${t.common.kg}`)
      load()
    } catch (ex) {
      setErr(ex.status === 403 ? tc.needFarmer : ex.message)
    }
  }

  const submitForm = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    try {
      await api.post('/coop', { ...form, product_id: +form.product_id, target_kg: +form.target_kg, min_price_som: +form.min_price_som || 0 })
      setShowForm(false); load()
    } catch (ex) {
      setErr(ex.status === 403 ? tc.needAdmin : ex.message)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">🤝 {tc.title}</h1>
          <p className="muted mt-1">{tc.sub}</p>
        </div>
        <button onClick={() => me?.role === 'admin' ? setShowForm(true) : setErr(tc.needAdmin)}
          className="px-5 py-2.5 rounded-full font-semibold text-white bg-oruk-500 hover:bg-oruk-600 shadow-soft transition">
          ➕ {tc.createTitle}
        </button>
      </div>
      {err && <div className="mt-3 text-sm text-red-500">{err}</div>}
      {msg && <div className="mt-3 text-sm text-leaf-600 font-semibold">{msg}</div>}

      <div className="grid md:grid-cols-2 gap-5 mt-8">
        {list.map((c) => {
          const pct = Math.min(100, Math.round((c.pledged_kg / c.target_kg) * 100))
          return (
            <div key={c.id} className="card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg">{c.title}</h3>
                  <div className="text-xs muted mt-1">{pname(c.product_id)} · {tc.minPrice} ≥ {c.min_price_som} {t.common.som}/{t.common.kg}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${c.status === 'fulfilled' ? 'bg-leaf-500/15 text-leaf-600' : 'bg-oruk-500/10 text-oruk-500'}`}>
                  {c.status === 'fulfilled' ? `✔ ${tc.fulfilled}` : `⏳ ${tc.open}`}
                </span>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs muted mb-1.5">
                  <span>{tc.pledged}: <b className="text-oruk-500">{c.pledged_kg.toLocaleString?.()}</b> {t.common.kg}</span>
                  <span>{tc.target}: {c.target_kg.toLocaleString?.()} {t.common.kg}</span>
                </div>
                <div className="h-3.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: pct >= 100 ? 'linear-gradient(90deg,#22C55E,#16A34A)' : 'linear-gradient(90deg,#F97316,#EA580C)' }} />
                </div>
                <div className="text-[11px] muted mt-1">🗓 {tc.deadline}: {c.deadline} · 👤 {c.admin_name}</div>
              </div>

              {!!c.members?.length && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {c.members.map((m, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-oruk-500/10 muted">🌾 {m.full_name}: {m.pledged_kg} {t.common.kg}</span>
                  ))}
                </div>
              )}

              {c.status === 'open' && me?.role === 'farmer' && (
                <button onClick={() => setPledgeFor(c.id)}
                  className="mt-5 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-leaf-600 hover:bg-leaf-700 transition">
                  🤝 {tc.join}
                </button>
              )}
              {c.status === 'open' && !me && (
                <div className="mt-5 text-center text-xs muted border rounded-xl py-2.5" style={{ borderColor: 'var(--border)' }}>
                  {t.nav.login} → {tc.needFarmer}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* pledge modal */}
      {pledgeFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setPledgeFor(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitPledge} className="card p-6 w-full max-w-sm fade-in">
            <h3 className="font-bold text-lg">🤝 {tc.join}</h3>
            <input required type="number" min="1" placeholder={tc.pledgeKg} value={pledgeKg}
              onChange={(e) => setPledgeKg(e.target.value)}
              className="mt-4 w-full card px-3 py-2.5 bg-transparent outline-none focus:ring-2 ring-oruk-500/40" />
            <div className="mt-5 flex gap-2 justify-end">
              <button type="button" onClick={() => setPledgeFor(null)} className="px-4 py-2 rounded-full text-sm muted border" style={{ borderColor: 'var(--border)' }}>{t.common.cancel}</button>
              <button className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-leaf-600 hover:bg-leaf-700">OK</button>
            </div>
          </form>
        </div>
      )}

      {/* create coop modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitForm} className="card p-6 w-full max-w-lg fade-in space-y-3">
            <h3 className="font-bold text-lg">➕ {tc.createTitle}</h3>
            <input required placeholder="Название партии" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full card px-3 py-2.5 bg-transparent outline-none text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="card px-3 py-2.5 bg-transparent outline-none text-sm">
                <option value="">{t.prices.product}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{lang === 'kg' ? p.name_kg : p.name_ru}</option>)}
              </select>
              <input required type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="card px-3 py-2.5 bg-transparent outline-none text-sm" />
              <input required type="number" min="1" placeholder={`${tc.target} (${t.common.kg})`} value={form.target_kg}
                onChange={(e) => setForm({ ...form, target_kg: e.target.value })}
                className="card px-3 py-2.5 bg-transparent outline-none text-sm" />
              <input type="number" min="0" step="0.1" placeholder={`${tc.minPrice} (${t.common.som})`} value={form.min_price_som}
                onChange={(e) => setForm({ ...form, min_price_som: e.target.value })}
                className="card px-3 py-2.5 bg-transparent outline-none text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-full text-sm muted border" style={{ borderColor: 'var(--border)' }}>{t.common.cancel}</button>
              <button className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-oruk-500 hover:bg-oruk-600">{tc.createBtn}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
