import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, LayoutGrid, Search, UserRound, X, Hash, Ruler, Layers, Cog } from 'lucide-react'
import { CrossRefInput, ApplicationInput } from './HomeSearch'

type Step = null | 'choose' | 'oem' | 'machine'

const CHOICES = [
  { id: 'oem', label: 'Search by OEM Part No.', icon: Hash },
  { id: 'size', label: 'Search by Size', icon: Ruler },
  { id: 'category', label: 'Search by Category', icon: Layers },
  { id: 'machine', label: 'Search by Machine', icon: Cog },
] as const

export function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(null)

  useEffect(() => { setStep(null) }, [pathname])

  // The header's search icon opens the same menu
  useEffect(() => {
    const open = () => setStep('choose')
    window.addEventListener('open-search', open)
    return () => window.removeEventListener('open-search', open)
  }, [])

  const pick = (id: (typeof CHOICES)[number]['id']) => {
    if (id === 'oem' || id === 'machine') setStep(id)
    else { setStep(null); navigate(id === 'size' ? '/size-search' : '/categories') }
  }

  const itemCls = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
      active ? 'text-accent' : 'text-ink-soft'
    }`

  return (
    <>
      {step && (
        <div className="fixed inset-0 z-50 flex flex-col items-center bg-ink/60 px-5 pt-24 backdrop-blur-[2px] animate-fade-in" onClick={() => setStep(null)}>
          <button aria-label="Close" className="absolute right-5 top-5 rounded-full bg-white p-2 text-ink" onClick={() => setStep(null)}>
            <X className="h-5 w-5" />
          </button>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {step === 'choose' && (
              <div className="flex flex-col gap-3">
                <p className="mb-1 text-center text-sm font-semibold text-white">Search by</p>
                {CHOICES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pick(c.id)}
                    className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-left text-base font-bold text-ink shadow-pop transition-colors hover:bg-primary-light"
                  >
                    <c.icon className="h-5 w-5 text-primary" />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {step === 'oem' && (
              <div className="rounded-xl bg-white p-4 shadow-pop">
                <p className="mb-3 text-sm font-bold text-ink">OEM Part No.</p>
                <CrossRefInput />
              </div>
            )}
            {step === 'machine' && (
              <div className="rounded-xl bg-white p-4 shadow-pop">
                <p className="mb-3 text-sm font-bold text-ink">Machine model</p>
                <ApplicationInput />
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-pop">
        <div className="mx-auto flex max-w-xl items-end">
          <NavLink to="/" className={itemCls(pathname === '/')}>
            <Home className="h-5 w-5" />
            Home
          </NavLink>
          <NavLink to="/categories" className={itemCls(pathname.startsWith('/categories'))}>
            <LayoutGrid className="h-5 w-5" />
            Categories
          </NavLink>
          <button onClick={() => setStep('choose')} className="flex flex-1 flex-col items-center gap-1 pb-2 text-[11px] font-semibold text-accent">
            <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-pop ring-4 ring-primary-light">
              <Search className="h-6 w-6 text-accent" />
            </span>
            Search
          </button>
          <NavLink to="/admin" className={itemCls(pathname.startsWith('/admin'))}>
            <UserRound className="h-5 w-5" />
            Profile
          </NavLink>
        </div>
      </nav>
    </>
  )
}
