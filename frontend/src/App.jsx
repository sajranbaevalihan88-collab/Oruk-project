import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, fetchMe, setToken, getToken } from './api.js'
import { T } from './i18n.js'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Prices from './pages/Prices.jsx'
import Agronom from './pages/Agronom.jsx'
import Bazaar from './pages/Bazaar.jsx'
import Coop from './pages/Coop.jsx'
import Login from './pages/Login.jsx'
import Profile from './pages/Profile.jsx'

const Ctx = createContext({})
export const useApp = () => useContext(Ctx)

export function useHashRoute() {
  const [route, setRoute] = useState(() => (location.hash || '#/').replace(/^#/, '') || '/')
  useEffect(() => {
    const fn = () => setRoute(location.hash.replace(/^#/, '') || '/')
    addEventListener('hashchange', fn)
    return () => removeEventListener('hashchange', fn)
  }, [])
  const nav = (to) => { location.hash = to; window.scrollTo(0, 0) }
  return [route, nav]
}

export default function App() {
  const [route, nav] = useHashRoute()
  const [me, setMe] = useState(null)
  const [lang, setLang] = useState(localStorage.getItem('oruk_lang') || 'ru')
  const [dark, setDark] = useState(localStorage.getItem('oruk_theme') === 'dark')
  const [products, setProducts] = useState([])

  useEffect(() => { fetchMe().then(setMe) }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('oruk_theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => { localStorage.setItem('oruk_lang', lang) }, [lang])
  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}) }, [])

  const t = T[lang]
  const login = (token, user) => { setToken(token); setMe(user) }
  const logout = () => { setToken(''); setMe(null); nav('/') }

  const page = (() => {
    if (route === '/prices') return <Prices products={products} />
    if (route === '/agronom') return <Agronom />
    if (route === '/bazaar') return <Bazaar products={products} />
    if (route === '/coop') return <Coop products={products} />
    if (route === '/login') return <Login onLogin={login} nav={nav} />
    if (route === '/profile') return <Profile />
    return <Home />
  })()

  return (
    <Ctx.Provider value={{ me, lang, setLang, dark, setDark, t, nav, products, api }}>
      <div className="min-h-screen flex flex-col fade-in">
        <Navbar route={route} me={me} onLogout={logout} />
        <main className="flex-1">{page}</main>
        <footer className="border-t py-8 text-center text-sm muted" style={{ borderColor: 'var(--border)' }}>
          {t.footer}
        </footer>
      </div>
    </Ctx.Provider>
  )
}
