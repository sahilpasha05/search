import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Hash, Package, Ruler, Search } from 'lucide-react'
import { getJSON, useDebounced, useMeta, type Suggestion } from '../lib/api'
import { PartTypeBadge, labelCls } from './ui'
// Suggestion is used by CrossRefInput below

// ─── Styles ──────────────────────────────────────────────────────────────────
const rowInput =
  'flex-1 min-w-0 rounded-l-lg border border-r-0 border-line bg-white px-4 py-3.5 text-sm text-ink placeholder:text-ink-soft/50 focus:border-primary focus:outline-none'
const orangeBtn =
  'flex w-12 shrink-0 items-center justify-center rounded-r-lg bg-accent text-white transition-colors hover:bg-accent-dark focus:outline-none'

// ─── Main 3-column search ─────────────────────────────────────────────────────
export function HomeSearch() {
  return (
    <div className="w-full rounded-2xl border border-line bg-white shadow-card">
      <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">

        {/* Column 1: Application — filter/product name */}
        <div className="px-5 py-4">
          <p className={`${labelCls} mb-2`}>Application</p>
          <ApplicationInput />
        </div>

        {/* Column 2: Cross Reference — SC catalog codes & OEM part numbers */}
        <div className="px-5 py-4">
          <p className={`${labelCls} mb-2`}>Cross Reference</p>
          <CrossRefInput />
        </div>
      </div>

      {/* Dimensions search row */}
      <div className="border-t border-line px-5 py-4">
        <DimensionsRow />
      </div>
    </div>
  )
}

// ─── Dimensions search row ────────────────────────────────────────────────────
function DimensionsRow() {
  const meta = useMeta()
  const navigate = useNavigate()
  const [category, setCategory] = useState('')

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    if (category) navigate(`/size-search?category=${encodeURIComponent(category)}`)
    else navigate('/size-search')
  }

  return (
    <form onSubmit={go} className="flex items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <Ruler className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">Dimensions</span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
        >
          <option value="">Please select a product group</option>
          {(meta?.categories ?? []).map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="flex w-10 h-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 focus:outline-none"
          aria-label="Search by dimensions"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}

// ─── Application: machine model search ───────────────────────────────────────
function ApplicationInput() {
  const [q, setQ] = useState('')
  const [models, setModels] = useState<{ model: string; manufacturer: string }[]>([])
  const [open, setOpen] = useState(false)
  const debounced = useDebounced(q, 180)
  const navigate = useNavigate()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounced.trim().length < 1) { setModels([]); return }
    getJSON<{ models: { model: string; manufacturer: string }[] }>(
      `/api/suggest-models?q=${encodeURIComponent(debounced)}`
    )
      .then((r) => { setModels(r.models ?? []); setOpen(true) })
      .catch(() => {})
  }, [debounced])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (model: string) => { setOpen(false); navigate(`/search?q=${encodeURIComponent(model)}&mode=app`) }

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q.trim()) }} className="flex">
        <input
          className={rowInput}
          placeholder="Machine model, brand, or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim().length >= 1 && setOpen(true)}
          autoComplete="off"
        />
        <button type="submit" aria-label="Search" className={orangeBtn}>
          <Search className="h-5 w-5" />
        </button>
      </form>
      {open && models.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[480px] max-w-[90vw] overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-fade-in">
          <div className="p-2">
            <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-soft">Machine Models</p>
            {models.map((m, i) => (
              <button
                key={i}
                onClick={() => go(m.model)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary-light/60"
              >
                <Package className="h-4 w-4 shrink-0 text-ink-soft/40" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{m.model}</p>
                  {m.manufacturer && <p className="text-xs text-ink-soft">{m.manufacturer}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Cross Reference: SC codes + OEM part numbers ────────────────────────────
function CrossRefInput() {
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [products, setProducts] = useState<{ id: number; name: string; code: string }[]>([])
  const [open, setOpen] = useState(false)
  const debounced = useDebounced(q, 180)
  const navigate = useNavigate()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounced.trim().length < 2) { setSuggestions([]); setProducts([]); return }
    getJSON<{ suggestions: Suggestion[]; products: { id: number; name: string; code: string }[] }>(
      `/api/suggest?q=${encodeURIComponent(debounced)}`
    )
      .then((r) => {
        const hasSuggestions = (r.suggestions?.length ?? 0) > 0
        const hasProducts = (r.products?.length ?? 0) > 0
        if (hasSuggestions || hasProducts) {
          setSuggestions(r.suggestions)
          setProducts(r.products ?? [])
          setOpen(true)
        }
        // if empty, keep previous results visible so dropdown doesn't flicker away
      })
      .catch(() => {})
  }, [debounced])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (query: string) => { setOpen(false); navigate(`/?q=${encodeURIComponent(query)}`) }

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q.trim()) }} className="flex">
        <input
          className={rowInput}
          placeholder="SC code or OEM part number…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim().length >= 2 && setOpen(true)}
          autoComplete="off"
        />
        <button type="submit" aria-label="Search" className={orangeBtn}>
          <Search className="h-5 w-5" />
        </button>
      </form>
      {open && (products.length > 0 || suggestions.length > 0) && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[520px] max-w-[90vw] overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-fade-in">
          <div className="p-2">
            {/* SC catalog codes */}
            {products.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-soft">SC Products</p>
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => go(p.code)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary-light/60"
                  >
                    <Package className="h-4 w-4 shrink-0 text-ink-soft/40" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">{p.code}</span>
                        <span className="rounded bg-primary-light px-1.5 py-0.5 text-[10px] font-semibold text-primary">SC</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-soft">{p.name}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
            {/* OEM cross-reference numbers */}
            {suggestions.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  {products.length > 0 ? 'OEM Cross References' : 'Part Numbers'}
                </p>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => go(s.number)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary-light/60"
                  >
                    <Hash className="h-4 w-4 shrink-0 text-ink-soft/40" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">{s.number}</span>
                        {s.maker && <span className="text-xs text-ink-soft">— {s.maker}</span>}
                        <PartTypeBadge type={s.type} />
                        {s.approx && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">≈ close</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-soft">{s.product_name}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Gaskets & Dies search ────────────────────────────────────────────────────
function GasketSearchInput() {
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/gaskets?q=${encodeURIComponent(q.trim())}`)
    else navigate('/gaskets')
  }

  return (
    <form onSubmit={go} className="flex">
      <input
        className={rowInput}
        placeholder="Part no, die code, CCN, model…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      <button type="submit" aria-label="Search gaskets" className={orangeBtn}>
        <Search className="h-5 w-5" />
      </button>
    </form>
  )
}

// ─── Category image grid ──────────────────────────────────────────────────────
export function CategoryGrid() {
  const meta = useMeta()
  return (
    <section>
      <h2 className="mb-5 text-xl font-bold text-ink">Product categories</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Link
          to="/gaskets"
          className="group overflow-hidden rounded-xl border border-line bg-white shadow-card transition-all hover:border-primary/40 hover:shadow-pop"
        >
          <div className="flex h-36 items-center justify-center bg-surface p-4">
            <img src="/img/cat-gasket.svg" alt="Gaskets & Dies" className="h-24 w-full object-contain" loading="lazy" />
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-ink transition-colors group-hover:text-primary">Gaskets / Dies</p>
            <p className="mt-0.5 text-xs text-ink-soft">Model-wise catalogue</p>
          </div>
        </Link>
        {(meta?.categories ?? []).map((c) => (
          <Link
            key={c.id}
            to={`/products?category=${c.slug}`}
            className="group overflow-hidden rounded-xl border border-line bg-white shadow-card transition-all hover:border-primary/40 hover:shadow-pop"
          >
            <div className="flex h-36 items-center justify-center bg-surface p-4">
              <img
                src={c.image}
                alt={c.name}
                className="h-24 w-full object-contain"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-ink transition-colors group-hover:text-primary">{c.name}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{c.product_count} products</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** @deprecated Use CategoryGrid instead */
export function CategoryRows() {
  const meta = useMeta()
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mt-6 divide-y divide-line">
        <Link to="/gaskets" className="group flex items-center gap-4 py-3.5 transition-colors hover:bg-surface/60">
          <img src="/img/cat-gasket.svg" alt="Gaskets and dies" className="h-16 w-24 shrink-0 rounded-lg border border-line bg-surface object-cover" loading="lazy" />
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug transition-colors group-hover:text-primary">Gaskets / Dies</p>
            <p className="mt-0.5 text-xs text-ink-soft">Model-wise gasket catalogue with Si die codes &amp; CCN</p>
          </div>
          <span className="pr-1 text-ink-soft/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M1.5 1.5 8.5 8l-7 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        </Link>
        {(meta?.categories ?? []).map((c) => (
          <Link key={c.id} to={`/products?category=${c.slug}`} className="group flex items-center gap-4 py-3.5 transition-colors hover:bg-surface/60">
            <img src={c.image} alt={c.name} className="h-16 w-24 shrink-0 rounded-lg border border-line bg-surface object-cover" loading="lazy" />
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug transition-colors group-hover:text-primary">{c.name}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{c.product_count} products</p>
            </div>
            <span className="pr-1 text-ink-soft/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary">
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M1.5 1.5 8.5 8l-7 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
