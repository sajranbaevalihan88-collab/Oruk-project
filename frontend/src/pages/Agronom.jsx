import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../App.jsx'
import { api } from '../api.js'

export default function Agronom() {
  const { t, me, nav } = useApp()
  const ta = t.agronom
  const [messages, setMessages] = useState([{ role: 'assistant', text: ta.hello }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState('')
  const boxRef = useRef(null)

  useEffect(() => {
    if (me) api.get('/agronom/history').then((h) => {
      if (h.length) setMessages([{ role: 'assistant', text: ta.hello }, ...h])
    }).catch(() => {})
  }, [me])

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const ask = async (q) => {
    const text = (q ?? input).trim()
    if (!text || busy) return
    if (!me) { nav('/login'); return }
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const r = await api.post('/agronom/chat', { message: text })
      setSource(r.source)
      setMessages((m) => [...m, { role: 'assistant', text: r.answer }])
    } catch (ex) {
      setMessages((m) => [...m, { role: 'assistant', text: `${t.common.error}: ${ex.message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl grid place-items-center text-2xl bg-gradient-to-br from-leaf-500 to-leaf-700 text-white shadow-soft">🤖</div>
        <div>
          <h1 className="text-3xl font-black">{ta.title}</h1>
          <p className="muted text-sm">{ta.sub}</p>
        </div>
        {source && <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold bg-oruk-500/10 text-oruk-500">
          {source === 'gemini' ? `⚡ ${ta.gemini}` : `📴 ${ta.offline}`}
        </span>}
      </div>

      <div ref={boxRef} className="card mt-6 p-4 md:p-6 h-[55vh] overflow-y-auto flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'chat-bubble-user self-end rounded-br-md' : 'chat-bubble-bot self-start rounded-bl-md'}`}>
            {m.role === 'assistant' && <div className="text-[10px] uppercase tracking-wider muted mb-1">🌾 Örük Агроном</div>}
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="chat-bubble-bot self-start rounded-2xl rounded-bl-md px-4 py-3 text-sm muted">
            <span className="inline-flex gap-1 items-center">
              <span className="w-2 h-2 rounded-full bg-oruk-500 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-oruk-500 animate-bounce [animation-delay:120ms]" />
              <span className="w-2 h-2 rounded-full bg-oruk-500 animate-bounce [animation-delay:240ms]" />
              <span className="ml-2">{ta.thinking}</span>
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {ta.suggestions.map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={busy}
            className="px-3 py-1.5 rounded-full text-xs border muted hover:border-oruk-500 hover:text-oruk-500 transition" style={{ borderColor: 'var(--border)' }}>
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask() }} className="mt-4 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={ta.placeholder}
          className="flex-1 card px-4 py-3 bg-transparent outline-none focus:ring-2 ring-oruk-500/40" />
        <button disabled={busy} className="px-6 py-3 rounded-2xl font-semibold text-white bg-oruk-500 hover:bg-oruk-600 disabled:opacity-50 shadow-soft transition">
          ➤ {ta.send}
        </button>
      </form>
    </div>
  )
}
