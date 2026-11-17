import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../App.jsx'
import LineChart from '../components/LineChart.jsx'
import { api } from '../api.js'
import { REGIONS } from '../regions.js'

export default function Prices({ products }) {
  const { t, lang, me } = useApp()
  const tp = t.prices
  const [productId, setProductId] = useState(null)
  const [region, setRegion] = useState('')
  const [data, setData] = useState({ reports: [], fair: [] })
  const [history, setHistory] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ price_som: '' })
  const [reportRegion, setReportRegion] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { if (products.length && !productId) setProductId(products[0].id) }, [products])

  const load = () => {
    if (!productId) return
    const q = new URLSearchParams({ product_id: productId })
    if (region) q.set('region', region)
    api.get('/prices/latest?' + q).then(setData).catch(() => {})
    api.get(`/prices/history?${q}`).then(setHistory).catch(() => {})
  }
  useEffect(load, [productId, region])

  const fairList = useMemo(() => data.fair || [], [data])
  const productName = (id) => {
    const p = products.find((x) => x.id === id)
    return p ? (lang === 'kg' ? p.name_kg : p.name_ru) : ''
  }

  const trendBadge = () => {
    if (!history) return null
    const dir = history.direction
    const cls = dir === 'up' ? 'bg-leaf-500/15 text-leaf-600' : dir === 'down' ? 'bg-red-500/15 text-red-500' : 'bg-oruk-500/10 muted'
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${cls}`}>
        {dir === 'up' ? '📈' : dir === 'down' ? '📉' : '➖'} {tp.trend[dir]}
        {history.forecast != null && <> · {tp.forecast}: <b>{history.forecast} {t.common.som}</b></>}
      </span>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setMsg('')
    try {
      await api.post('/prices', { product_id: productId, region: reportRegion, price_som: parseFloat(form.price_som) })
      setMsg(tp.reported); setShowForm(false); setForm({ price_som: '' }); load()
    } catch (ex) {
      setErr(ex.status === 403 ? tp.needFarmer : ex.message)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black">{tp.title}</h1>
      <p className="muted mt-1">{tp.sub}</p>

      {/* filters */}
      <div className="mt-6 flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <div className="muted mb-1 text-xs">{tp.product}</div>
          <select value={productId || ''} onChange={(e) => setProductId(+e.target.value)}
            className="card px-3 py-2 bg-transparent outline-none min-w-44">
            {products.map((p) => <option key={p.id} value={p.id}>{lang === 'kg' ? p.name_kg : p.name_ru}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <div className="muted mb-1 text-xs">{tp.region}</div>
          <select value={region} onChange={(e) => setRegion(e.target.value)}
            className="card px-3 py-2 bg-transparent outline-none min-w-36">
            <option value="">{tp.all}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <button onClick={() => { if (me) { setReportRegion(region || me.region || 'Баткен'); setShowForm(true) } else setErr(tp.needFarmer) }}
          className="px-5 py-2.5 rounded-full font-semibold text-white bg-oruk-500 hover:bg-oruk-600 shadow-soft transition">
          ✍️ {tp.report}
        </button>
        {trendBadge()}
      </div>
      {err && <div className="mt-3 text-sm text-red-500">{err}</div>}
      {msg && <div className="mt-3 text-sm text-leaf-600 font-semibold">{msg}</div>}

      {/* chart */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold">{tp.history} · {history && `${history.current ?? '—'} ${t.common.som}/${t.common.kg}`}</h2>
        </div>
        <div className="mt-3"><LineChart data={history?.series || []} warnLast={history?.direction === 'down'} height={280} /></div>
      </div>

      {/* fair prices */}
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        {fairList.slice(0, 6).map((f) => (
          <div key={f.product_id + f.region} className="card p-5">
            <div className="text-xs muted">{productName(f.product_id)} · {f.region}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black text-oruk-500">{f.fair_price}</span>
              <span className="text-xs muted">{t.common.som}/{t.common.kg}</span>
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-leaf-500/15 text-leaf-600">✓ {f.n_reports} {tp.reports}</span>
              <span className="px-2 py-0.5 rounded-full bg-oruk-500/10 muted">{f.min}–{f.max}</span>
            </div>
          </div>
        ))}
      </div>

      {/* latest reports */}
      <div className="card mt-6 overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold" style={{ borderColor: 'var(--border)' }}>{tp.latest}</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs muted">
              <th className="px-5 py-2">{tp.who}</th><th className="px-5 py-2">{tp.product}</th>
              <th className="px-5 py-2">{tp.region}</th><th className="px-5 py-2 text-right">{tp.priceKg}</th>
              <th className="px-5 py-2">{tp.when}</th>
            </tr>
          </thead>
          <tbody>
            {data.reports.slice(0, 12).map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-5 py-2.5 font-medium">{r.full_name}</td>
                <td className="px-5 py-2.5">{lang === 'kg' ? r.name_kg : r.name_ru}</td>
                <td className="px-5 py-2.5">{r.region}</td>
                <td className="px-5 py-2.5 text-right font-bold text-oruk-500">{r.price_som}</td>
                <td className="px-5 py-2.5 muted text-xs">{(r.reported_at || '').replace('T', ' ').slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* report modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="card p-6 w-full max-w-md fade-in">
            <h3 className="font-bold text-lg">✍️ {tp.report}</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="card px-3 py-2 muted">{productName(productId)}</div>
              <label className="block">
                <div className="muted mb-1 text-xs">{tp.region}</div>
                <select required value={reportRegion} onChange={(e) => setReportRegion(e.target.value)}
                  className="w-full card px-3 py-2.5 bg-transparent outline-none focus:ring-2 ring-oruk-500/40">
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <input required type="number" step="0.1" min="0.1" placeholder={tp.form.price}
                value={form.price_som} onChange={(e) => setForm({ price_som: e.target.value })}
                className="w-full card px-3 py-2.5 bg-transparent outline-none focus:ring-2 ring-oruk-500/40" />
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-full text-sm muted border" style={{ borderColor: 'var(--border)' }}>{t.common.cancel}</button>
              <button className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-oruk-500 hover:bg-oruk-600">{tp.form.submit}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
