import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Ana Sayfa', icon: '⌂', end: true },
  { to: '/plan', label: 'Plan', icon: '▦' },
  { to: '/workout', label: 'Başla', icon: '▶', start: true },
  { to: '/stats', label: 'İstatistik', icon: '▲' },
  { to: '/library', label: 'Egzersizler', icon: '☰' },
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
