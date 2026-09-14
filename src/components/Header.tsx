import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Filter, Menu, Search, Settings, X, LogOut, UserCircle } from 'lucide-react'
import { Container } from './ui'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/', label: 'Search', end: true },
  { to: '/gaskets', label: 'Gaskets & Dies', end: false },
  { to: '/products', label: 'Products', end: false },
  { to: '/categories', label: 'Categories', end: false },
]

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-md ${onDark ? 'bg-white/15' : 'bg-primary'}`}>
        <Filter className="h-4 w-4 text-white" strokeWidth={2.5} />
      </span>
      <span className={`text-base font-bold tracking-tight ${onDark ? 'text-white' : 'text-ink'}`}>
        Filter<span className={onDark ? 'text-accent' : 'text-primary'}>Core</span>
      </span>
    </Link>
  )
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = async () => { await logout(); navigate('/') }

  const iconBtn = 'rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white'

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink shadow-sm">
      <Container className="flex h-14 items-center justify-between gap-4">
        {/* Left: logo + mobile menu */}
        <div className="flex items-center gap-2">
          <button onClick={() => setMenuOpen(true)} className={`${iconBtn} -ml-1 lg:hidden`} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <Logo onDark />
          <span className="hidden text-xs text-white/40 lg:block ml-3 border-l border-white/20 pl-3">
            Internal Catalog
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: search + user */}
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/search')} className={iconBtn} aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
            >
              <Settings className="h-3.5 w-3.5" />
              Admin
            </Link>
          )}
          {/* User chip */}
          <div className="ml-1 hidden sm:flex items-center gap-2 rounded-md border border-white/20 px-2.5 py-1.5">
            <UserCircle className="h-4 w-4 text-white/70" />
            <span className="text-xs font-medium text-white/80">{user?.full_name || user?.username}</span>
            <span className={`text-[10px] rounded px-1 py-0.5 font-semibold ${user?.role === 'admin' ? 'bg-accent/80 text-white' : 'bg-white/15 text-white/70'}`}>
              {user?.role}
            </span>
          </div>
          <button onClick={handleLogout} className={iconBtn} aria-label="Logout" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </Container>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-ink/50" />
          <div
            className="absolute left-0 top-0 h-full w-64 bg-white p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMenuOpen(false)} className="rounded-md p-1.5 text-ink-soft hover:bg-surface">
                <X className="h-4 w-4" />
              </button>
            </div>
            {user && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                <UserCircle className="h-4 w-4 shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{user.full_name || user.username}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${user.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-surface text-ink-soft border border-line'}`}>{user.role}</span>
              </div>
            )}
            <nav className="flex flex-col gap-0.5">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-surface'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              {user?.role === 'admin' && (
                <>
                  <div className="my-2 border-t border-line" />
                  <NavLink
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-accent hover:bg-surface"
                  >
                    <Settings className="h-4 w-4" />
                    Admin Panel
                  </NavLink>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
