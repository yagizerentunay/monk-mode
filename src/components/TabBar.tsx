import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const TABS = [
  { to: '/', label: 'Ana', end: true, icon: svg(<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />) },
  { to: '/plan', label: 'Plan', icon: svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>) },
  { to: '/workout', label: 'Başla', start: true, icon: svg(<path d="M8 5.5v13l11-6.5z" fill="currentColor" />) },
  { to: '/stats', label: 'Analiz', icon: svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />) },
  { to: '/library', label: 'Egzersiz', icon: svg(<path d="M3 9v6M6.5 6.5v11M17.5 6.5v11M21 9v6M6.5 12h11" />) },
]

export function TabBar() {
  return (
    <div className="tabbar">
      <nav>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `tab${t.start ? ' start' : ''}${isActive ? ' active' : ''}`}
          >
            <span className="ico" aria-hidden="true">{t.icon}</span>
            {t.start ? <span>{t.label}</span> : t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
