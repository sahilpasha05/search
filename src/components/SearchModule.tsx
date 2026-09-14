import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Hash, Ruler, LayoutGrid, Search } from 'lucide-react'
import { getJSON, useDebounced, useMeta, type Suggestion } from '../lib/api'
import { PartTypeBadge, btnAccent, inputCls, labelCls } from './ui'

export type SearchTab = 'part' | 'size' | 'category'

const TABS: { id: SearchTab; label: string; icon: React.ElementType }[] = [
  { id: 'part', label: 'OEM / Part Number', icon: Hash },
  { id: 'size', label: 'Size / Specifications', icon: Ruler },
  { id: 'category', label: 'Category', icon: LayoutGrid },
]

export function SearchModule({ initialTab = 'part', compact = false }: { initialTab?: SearchTab; compact?: boolean }) {
  const [tab, setTab] = useState<SearchTab>(initialTab)

  return (
    <div className="w-full rounded-2xl border border-line bg-white shadow-card">
      {/* Tabs */}
      <div className="flex border-b border-line">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex flex-1 items-center justify-center gap-2 px-2 py-3.5 text-xs font-semibold transition-colors sm:text-sm ${
              tab === id ? 'text-primary' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{id === 'part' ? 'Part No.' : id === 'size' ? 'Size' : 'Category'}</span>
            {tab === id && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {tab === 'part' && <PartSearch />}
        {tab === 'size' && <SizeSearch compact={compact} />}
        {tab === 'category' && <CategoryQuickPick />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Part number search with intelligent suggestions
// ---------------------------------------------------------------------------

function PartSearch() {
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
      `/api/suggest?q=${encodeURIComponent(debounced)}`,
    )
      .then((r) => { setSuggestions(r.suggestions); setProducts(r.products); setOpen(true) })
      .catch(() => {})
  }, [debounced])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (query: string) => {
    setOpen(false)
    navigate({ search: `?q=${encodeURIComponent(query)}` })
  }

  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q.trim()) }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q.trim().length >= 2 && setOpen(true)}
            placeholder="Enter OEM Part Number e.g. C14200"
            className={`${inputCls} py-3.5 pl-11 text-base`}
            autoComplete="off"
          />
        </div>
        <button type="submit" className={`${btnAccent} py-3.5 sm:px-8`}>
          Search
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-2.5 text-xs text-ink-soft">
        Searches filters, gaskets &amp; dies — partial numbers and hyphen variations matched automatically.
      </p>

      {open && (suggestions.length > 0 || products.length > 0) && (
        <div className="absolute inset-x-0 top-[calc(100%-1.25rem)] z-30 overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-fade-in">
          {suggestions.length > 0 && (
            <div className="p-2">
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-soft">Part numbers</p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => go(s.number)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary-light/60"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Hash className="h-3.5 w-3.5 shrink-0 text-ink-soft/50" />
                    <span className="truncate font-mono text-sm font-medium">{s.number}</span>
                    <PartTypeBadge type={s.type} />
                    {s.approx && <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">≈ close match</span>}
                  </span>
                  <span className="hidden truncate text-xs text-ink-soft sm:block">{s.product_name}</span>
                </button>
              ))}
            </div>
          )}
          {products.length > 0 && (
            <div className="border-t border-line p-2">
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-soft">Products</p>
              {products.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary-light/60"
                >
                  {p.name}
                  <span className="font-mono text-xs text-ink-soft">{p.code}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Size / specification search
// ---------------------------------------------------------------------------

export function SizeSearch({ compact = false }: { compact?: boolean }) {
  const meta = useMeta()
  const navigate = useNavigate()
  const [f, setF] = useState({ od: '', idm: '', len: '', micron: '', thread: '', material: '', filterType: '', tol: '5' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams({ mode: 'size' })
    Object.entries(f).forEach(([k, v]) => { if (v !== '') params.set(k, v) })
    navigate({ search: `?${params.toString()}` })
  }

  const selectCls = inputCls + ' appearance-none'

  return (
    <form onSubmit={submit}>
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${compact ? 'lg:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-4'}`}>
        <div>
          <label className={labelCls}>Outer Diameter (mm)</label>
          <input type="number" inputMode="decimal" className={inputCls} placeholder="e.g. 100" value={f.od} onChange={set('od')} />
        </div>
        <div>
          <label className={labelCls}>Inner Diameter (mm)</label>
          <input type="number" inputMode="decimal" className={inputCls} placeholder="e.g. 50" value={f.idm} onChange={set('idm')} />
        </div>
        <div>
          <label className={labelCls}>Length / Height (mm)</label>
          <input type="number" inputMode="decimal" className={inputCls} placeholder="e.g. 250" value={f.len} onChange={set('len')} />
        </div>
        <div>
          <label className={labelCls}>Max Micron Rating</label>
          <input type="number" inputMode="decimal" className={inputCls} placeholder="e.g. 10" value={f.micron} onChange={set('micron')} />
        </div>
        <div>
          <label className={labelCls}>Thread Size</label>
          <input className={inputCls} placeholder="e.g. M20 x 1.5" value={f.thread} onChange={set('thread')} />
        </div>
        <div>
          <label className={labelCls}>Filter Type</label>
          <select className={selectCls} value={f.filterType} onChange={set('filterType')}>
            <option value="">Any type</option>
            {meta?.filterTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Material</label>
          <select className={selectCls} value={f.material} onChange={set('material')}>
            <option value="">Any material</option>
            {meta?.materials.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Size Tolerance</label>
          <select className={selectCls} value={f.tol} onChange={set('tol')}>
            <option value="0">Exact match</option>
            <option value="2">± 2 mm</option>
            <option value="5">± 5 mm</option>
            <option value="10">± 10 mm</option>
          </select>
        </div>
      </div>
      <button type="submit" className={`${btnAccent} mt-5 w-full py-3 sm:w-auto sm:px-10`}>
        Find Matching Filters
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// 3. Category quick pick
// ---------------------------------------------------------------------------

function CategoryQuickPick() {
  const meta = useMeta()
  return (
    <div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {(meta?.categories ?? []).map((c) => (
          <Link
            key={c.id}
            to={`/products?category=${c.slug}`}
            className="group flex items-center justify-between rounded-xl border border-line px-4 py-3 transition-all hover:border-primary/50 hover:bg-primary-light/40"
          >
            <span className="text-sm font-medium">{c.name}</span>
            <span className="flex items-center gap-2 text-xs text-ink-soft">
              {c.product_count}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        Not sure of the category? <Link to="/categories" className="font-medium text-primary hover:underline">Browse all categories</Link> with pictures and descriptions.
      </p>
    </div>
  )
}
