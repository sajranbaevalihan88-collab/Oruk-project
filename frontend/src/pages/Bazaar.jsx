import React, { useEffect, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../api.js'
import { REGIONS } from '../regions.js'

export default function Bazaar({ products }) {
  const { t, lang, me, nav } = useApp()
  const tb = t.bazaar
  const [lots, setLots] = useState([])
  const [fRegion, setFRegion] = useState('')
  const [fProduct, setFProduct] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_id: '', quantity_kg: '', price_som: '', region: '', description: '' })
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = () => {
    const q = new URLSearchParams()
    if (fRegion) q.set('region', fRegion)
    if (fProduct) q.set('product_id', fProduct)
    api.get('/lots?' + q).then(setLots).catch(() => {})
  }
  useEffect(load, [fRegion, fProduct])

  const pname = (id) => {
    const p = products.find((x) => x.id === id)
    return p ? (lang === 'kg' ? p.name_kg : p.name_ru) : ''
  }

  const reserve = async (id) => {
    setErr(''); setMsg('')
    try {
      await api.post(`/lots/${id}/reserve`)
      setMsg(tb.reservedOk); load()
    } catch (ex) {
      setErr(ex.status === 403 ? tb.needBuyer : ex.status === 401 ? t.nav.login + ' → ' + tb.needBuyer : ex.message)
    }
  }

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    try {
      await api.post('/lots', { ...form, product_id: +form.product_id, quantity_kg: +form.quantity_kg, price_som: +form.price_som })
      setShowForm(false); setForm({ product_id: '', quantity_kg: '', price_som: '', region: '', description: '' })
      load()
    } catch (ex) {
      setErr(ex.status === 403 ? tb.needFarmer : ex.message)
    }
  }

  const badge = (s) => s === 'active'
    ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-leaf-500/15 text-leaf-600">● {tb.active}</span>
    : s === 'reserved'
      ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-oruk-500/15 text-oruk-500">⏳ {tb.reserved}</span>
      : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 muted">✔ {tb.sold}</span>

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">{tb.title}</h1>
          <p className="muted mt-1">{tb.sub}</p>
        </div>
        <button onClick={() => me?.role === 'farmer' ? setShowForm(true) : setErr(tb.needFarmer)}
          className="px-5 py-2.5 rounded-full font-semibold text-white bg-oruk-500 hover:bg-oruk-600 shadow-soft transition">
          📦 {tb.createLot}
        </button>
      </div>
      {err && <div className="mt-3 text-sm text-red-500">{err}</div>}
      {msg && <div className="mt-3 text-sm text-leaf-600 font-semibold">{msg}</div>}

      <div className="mt-6 flex flex-wrap gap-3">
        <select value={fProduct} onChange={(e) => setFProduct(e.target.value)} className="card px-3 py-2 bg-transparent outline-none text-sm">
          <option value="">{t.prices.product}: {t.prices.all}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{lang === 'kg' ? p.name_kg : p.name_ru}</option>)}
        </select>
        <select value={fRegion} onChange={(e) => setFRegion(e.target.value)} className="card px-3 py-2 bg-transparent outline-none text-sm">
          <option value="">{t.prices.region}: {t.prices.all}</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {lots.map((l) => (
          <div key={l.id} className="card p-5 flex flex-col hover:-translate-y-1 hover:shadow-soft transition">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs muted">{pname(l.product_id)}</div>
                <div className="text-xl font-black">{l.price_som} <span className="text-xs muted font-normal">{t.common.som}/{t.common.kg}</span></div>
              </div>
              {badge(l.status)}
            </div>
            <div className="mt-3 text-sm muted flex-1">{l.description || '—'}</div>
            <div className="mt-4 text-xs muted flex items-center justify-between">
              <span>🌾 {l.farmer_name} · 📍{l.region}</span>
              <span className="font-bold text-oruk-500">{l.quantity_kg.toLocaleString?.()} {t.common.kg}</span>
            </div>
            {l.status === 'active' && (
              <button onClick={() => reserve(l.id)}
                className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-leaf-600 hover:bg-leaf-700 transition">
                🤝 {tb.reserve}
              </button>
            )}
            {l.status === 'reserved' && l.reserved_by === me?.id && (
              <div className="mt-4 text-center text-xs font-semibold text-oruk-500 border border-oruk-500/30 rounded-xl py-2.5">
                📞 {l.farmer_phone}
              </div>
            )}
          </div>
        ))}
        {!lots.length && <div className="muted">{t.common.loading}…</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="card p-6 w-full max-w-lg fade-in space-y-3">
            <h3 className="font-bold text-lg">📦 {tb.createLot}</h3>
            <div className="grid grid-cols-2 gap-3">
              <select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="card px-3 py-2.5 bg-transparent outline-none text-sm">
                <option value="">{tb.product}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{lang === 'kg' ? p.name_kg : p.name_ru}</option>)}
              </select>
              <select required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="card px-3 py-2.5 bg-transparent outline-none text-sm">
                <option value="">{tb.region}</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input required type="number" min="1" placeholder={`${tb.quantity} (${t.common.kg})`} value={form.quantity_kg}
                onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                className="card px-3 py-2.5 bg-transparent outline-none text-sm" />
              <input required type="number" min="0.1" step="0.1" placeholder={`${tb.priceKg}`} value={form.price_som}
                onChange={(e) => setForm({ ...form, price_som: e.target.value })}
                className="card px-3 py-2.5 bg-transparent outline-none text-sm" />
            </div>
            <textarea rows="2" placeholder={tb.form.desc} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full card px-3 py-2.5 bg-transparent outline-none text-sm" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-full text-sm muted border" style={{ borderColor: 'var(--border)' }}>{t.common.cancel}</button>
              <button className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-oruk-500 hover:bg-oruk-600">{tb.form.submit}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
