import { NavLink, useLocation } from 'react-router-dom'
import { Home, LayoutGrid, Search, FileText, UserRound } from 'lucide-react'
import { useQuote } from './QuoteContext'

export function BottomNav() {
  const { openQuote } = useQuote()
  const { pathname } = useLocation()

  const itemCls = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
      active ? 'text-primary' : 'text-ink-soft'
    }`

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="flex items-end">
        <NavLink to="/" className={itemCls(pathname === '/')}>
          <Home className="h-5 w-5" />
          Home
        </NavLink>
        <NavLink to="/categories" className={itemCls(pathname.startsWith('/categories'))}>
          <LayoutGrid className="h-5 w-5" />
          Categories
        </NavLink>
        {/* Prominent central search */}
        <NavLink to="/search" className="flex flex-1 flex-col items-center gap-1 pb-2 text-[10px] font-semibold text-accent">
          <span className="-mt-5 flex h-13 w-13 items-center justify-center rounded-full bg-accent shadow-pop ring-4 ring-white">
            <Search className="h-6 w-6 text-white" />
          </span>
          Search
        </NavLink>
        <button onClick={() => openQuote()} className={itemCls(false)}>
          <FileText className="h-5 w-5" />
          Enquiry
        </button>
        <NavLink to="/admin" className={itemCls(pathname.startsWith('/admin'))}>
          <UserRound className="h-5 w-5" />
          Account
        </NavLink>
      </div>
    </nav>
  )
}
