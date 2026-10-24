import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { t, type MessageKey } from '../i18n/index.ts'

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const TABS: { to: string; label: MessageKey; end?: boolean; start?: boolean; icon: ReactNode }[] = [
  { to: '/', label: 'tab.home', end: true, icon: svg(<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />) },
  { to: '/plan', label: 'tab.plan', icon: svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>) },
  { to: '/workout', label: 'tab.start', start: true, icon: svg(<path d="M8 5.5v13l11-6.5z" fill="currentColor" />) },
  { to: '/stats', label: 'tab.stats', icon: svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />) },
  { to: '/library', label: 'tab.library', icon: svg(<path d="M3 9v6M6.5 6.5v11M17.5 6.5v11M21 9v6M6.5 12h11" />) },
]

export function TabBar() {
  return (
    <div className="tabbar">
      <nav>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tab${tab.start ? ' start' : ''}${isActive ? ' active' : ''}`}
          >
            <span className="ico" aria-hidden="true">{tab.icon}</span>
            {tab.start ? <span>{t(tab.label)}</span> : t(tab.label)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
