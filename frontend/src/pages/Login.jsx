import React, { useState } from 'react'
import { useApp } from '../App.jsx'
import { api, setToken } from '../api.js'
import { REGIONS } from '../regions.js'

const DEMO = [
  { u: 'farmer_abdireim', label: '🌾 Фермер (Абдиреим, Баткен)' },
  { u: 'buyer_osh', label: '🛒 Покупатель (Ош)' },
  { u: 'admin_batken', label: '🛡️ Админ района (Баткен)' },
]

export default function Login({ onLogin, nav }) {
  const { t } = useApp()
  const tl = t.login
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'farmer', region: 'Баткен', phone: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const path = mode === 'login' ? '/auth/jwt/create' : '/auth/register'
      const body = mode === 'login'
        ? { username: form.username, password: form.password }
        : { ...form }
      const r = await api.post(path, body)
      onLogin(r.access_token, r.user)
      nav('/profile')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  const demoLogin = async (username) => {
    setErr(''); setBusy(true)
    try {
      const r = await api.post('/auth/jwt/create', { username, password: 'demo2027' })
      onLogin(r.access_token, r.user)
      nav('/profile')
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  const inp = 'w-full card px-4 py-2.5 bg-transparent outline-none focus:ring-2 ring-oruk-500/40'

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card p-7">
        <div className="flex gap-2 mb-6">
          {['login', 'register'].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${mode === m ? 'bg-oruk-500 text-white shadow-soft' : 'muted border'}`}
              style={mode === m ? {} : { borderColor: 'var(--border)' }}>
              {m === 'login' ? tl.title : tl.register}
            </button>
          ))}
        </div>

        <form onSubmit={go} className="space-y-3">
          {mode === 'register' && (
            <>
              <input required placeholder={tl.name} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inp} />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inp}>
                {Object.entries(tl.roles).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={inp}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input placeholder={tl.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} />
            </>
          )}
          <input required placeholder={tl.username} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inp} />
          <input required type="password" placeholder={tl.password} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inp} />
          {err && <div className="text-sm text-red-500">{err}</div>}
          <button disabled={busy} className="w-full py-3 rounded-xl font-semibold text-white bg-oruk-500 hover:bg-oruk-600 disabled:opacity-50 shadow-soft transition">
            {mode === 'login' ? tl.submit : tl.registerBtn}
          </button>
        </form>
      </div>

      <div className="card p-5 mt-5">
        <div className="text-xs font-bold muted uppercase tracking-wider">{tl.demo}</div>
        <div className="mt-3 space-y-2">
          {DEMO.map((d) => (
            <button key={d.u} disabled={busy} onClick={() => demoLogin(d.u)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm hover:border-oruk-500 hover:bg-oruk-500/5 transition"
              style={{ borderColor: 'var(--border)' }}>
              <span>{d.label}</span>
              <span className="text-xs font-bold text-oruk-500">{tl.oneClick} →</span>
            </button>
          ))}
        </div>
        <div className="mt-3 text-[11px] muted">demo2027 • код группы кооперации: ÖRK-2027</div>
      </div>
    </div>
  )
}
