import React from 'react'
import { useApp } from '../App.jsx'

/** Beautiful SVG line chart with gradient area, dots and labels. */
export default function LineChart({ data, height = 260, colorFrom = '#F97316', colorTo = '#EA580C', valueSuffix = '', warnLast = false }) {
  const { t } = useApp()
  if (!data || data.length < 2) return <div className="h-40 grid place-items-center muted text-sm">{t.common.noData}</div>
  const w = 720
  const pad = { l: 46, r: 16, t: 18, b: 30 }
  const values = data.map(([, v]) => v)
  const max = Math.max(...values) * 1.08 || 1
  const min = Math.min(...values) * 0.9 || 0
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (data.length - 1)
  const y = (v) => pad.t + (1 - (v - min) / (max - min || 1)) * (height - pad.t - pad.b)
  const pts = data.map((d, i) => [x(i), y(d[1])])
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${height - pad.b} L${pts[0][0].toFixed(1)},${height - pad.b} Z`
  const gid = 'g' + Math.abs(hash(JSON.stringify(data)))
  const last = data[data.length - 1]
  const step = Math.ceil(data.length / 8)

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorFrom} stopOpacity="0.35" />
          <stop offset="100%" stopColor={colorTo} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => {
        const v = min + (max - min) * f
        return (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="4 6" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(v)}</text>
          </g>
        )
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={colorTo} strokeWidth="3" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 5.5 : 3}
          fill={i === pts.length - 1 && warnLast ? '#DC2626' : colorTo}
          stroke="var(--card)" strokeWidth="2" />
      ))}
      {data.map(([m], i) => i % step === 0 || i === data.length - 1 ? (
        <text key={m + i} x={x(i)} y={height - 8}
          textAnchor={i === data.length - 1 ? 'end' : 'middle'}
          fontSize="10.5" fill="var(--muted)">{m}</text>
      ) : null)}
      <g>
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="9" fill="#DC2626" opacity="0.25">
          <animate attributeName="r" values="7;11;7" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <text x={pts[pts.length - 1][0] - 10} y={pts[pts.length - 1][1] - 12} textAnchor="end"
          fontSize="13" fontWeight="700" fill="#DC2626">
          {last[1]}{valueSuffix}
        </text>
      </g>
    </svg>
  )
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
