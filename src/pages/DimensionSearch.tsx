import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getJSON, useMeta, type Product } from '../lib/api'
import { Container, Spinner } from '../components/ui'
import { ProductCard } from '../components/ProductCard'

// ── SVG dimension diagrams ─────────────────────────────────────────────────────

function SvgOD() {
  return (
    <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <ellipse cx="40" cy="18" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".35"/>
      <rect x="12" y="18" width="56" height="64" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
      <ellipse cx="40" cy="82" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45"/>
      <ellipse cx="40" cy="82" rx="14" ry="4" stroke="currentColor" strokeWidth="1" fill="none" opacity=".3"/>
      <line x1="12" y1="92" x2="68" y2="92" stroke="var(--color-primary,#2563eb)" strokeWidth="1.5"/>
      <polygon points="12,89 12,95 7,92" fill="var(--color-primary,#2563eb)"/>
      <polygon points="68,89 68,95 73,92" fill="var(--color-primary,#2563eb)"/>
      <text x="40" y="100" textAnchor="middle" fontSize="8" fill="var(--color-primary,#2563eb)" fontWeight="bold">OD</text>
    </svg>
  )
}

function SvgID() {
  return (
    <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <ellipse cx="40" cy="18" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".35"/>
      <rect x="12" y="18" width="56" height="64" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
      <ellipse cx="40" cy="82" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45"/>
      <rect x="26" y="18" width="28" height="64" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" fill="none" opacity=".4"/>
      <line x1="26" y1="92" x2="54" y2="92" stroke="var(--color-primary,#2563eb)" strokeWidth="1.5"/>
      <polygon points="26,89 26,95 21,92" fill="var(--color-primary,#2563eb)"/>
      <polygon points="54,89 54,95 59,92" fill="var(--color-primary,#2563eb)"/>
      <text x="40" y="100" textAnchor="middle" fontSize="8" fill="var(--color-primary,#2563eb)" fontWeight="bold">ID</text>
    </svg>
  )
}

function SvgLength() {
  return (
    <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <ellipse cx="40" cy="18" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".35"/>
      <rect x="12" y="18" width="56" height="64" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
      <ellipse cx="40" cy="82" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45"/>
      <line x1="76" y1="18" x2="76" y2="82" stroke="var(--color-primary,#2563eb)" strokeWidth="1.5"/>
      <polygon points="73,18 79,18 76,13" fill="var(--color-primary,#2563eb)"/>
      <polygon points="73,82 79,82 76,87" fill="var(--color-primary,#2563eb)"/>
      <text x="40" y="100" textAnchor="middle" fontSize="8" fill="var(--color-primary,#2563eb)" fontWeight="bold">Length</text>
    </svg>
  )
}

function SvgMicron() {
  return (
    <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <rect x="18" y="16" width="44" height="68" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".4"/>
      {[28,36,44,52,60,68,76].map((y,i) => (
        <line key={i} x1="18" y1={y} x2="62" y2={y} stroke="currentColor" strokeWidth="0.8" opacity=".2"/>
      ))}
      {[22,30,38,46,54,62,70].map((y,i) => (
        <circle key={i} cx={26 + (i % 4) * 10} cy={y} r="1.8" fill="var(--color-primary,#2563eb)" opacity=".55"/>
      ))}
      <text x="40" y="100" textAnchor="middle" fontSize="8" fill="var(--color-primary,#2563eb)" fontWeight="bold">µ Micron</text>
    </svg>
  )
}

function SvgLargestOD() {
  return (
    <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <ellipse cx="40" cy="18" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".35"/>
      <rect x="12" y="18" width="56" height="64" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
      <ellipse cx="40" cy="82" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45"/>
      {/* bulge at centre */}
      <ellipse cx="40" cy="50" rx="34" ry="10" stroke="var(--color-primary,#2563eb)" strokeWidth="1.2" strokeDasharray="3 2" fill="none"/>
      <line x1="6" y1="92" x2="74" y2="92" stroke="var(--color-primary,#2563eb)" strokeWidth="1.5"/>
      <polygon points="6,89 6,95 1,92" fill="var(--color-primary,#2563eb)"/>
      <polygon points="74,89 74,95 79,92" fill="var(--color-primary,#2563eb)"/>
      <text x="40" y="100" textAnchor="middle" fontSize="7" fill="var(--color-primary,#2563eb)" fontWeight="bold">Largest OD</text>
    </svg>
  )
}

function SvgBodyHeight() {
  return (
    <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <ellipse cx="40" cy="18" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".35"/>
      <rect x="12" y="18" width="56" height="64" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
      <ellipse cx="40" cy="82" rx="28" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45"/>
      {/* cap at top */}
      <rect x="28" y="10" width="24" height="10" rx="2" stroke="currentColor" strokeWidth="1" fill="none" opacity=".5"/>
      {/* body height arrow — excludes cap */}
      <line x1="76" y1="20" x2="76" y2="82" stroke="var(--color-primary,#2563eb)" strokeWidth="1.5"/>
      <polygon points="73,20 79,20 76,15" fill="var(--color-primary,#2563eb)"/>
      <polygon points="73,82 79,82 76,87" fill="var(--color-primary,#2563eb)"/>
      <text x="40" y="100" textAnchor="middle" fontSize="7" fill="var(--color-primary,#2563eb)" fontWeight="bold">Body Height</text>
    </svg>
  )
}

function SvgThread() {
  return (
    <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <rect x="24" y="30" width="32" height="52" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".4"/>
      {[30,37,44,51,58,65,72,79].map((y,i) => (
        <path key={i} d={`M24,${y} Q40,${y-5} 56,${y}`} stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".3"/>
      ))}
      <rect x="30" y="14" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".6"/>
      <text x="40" y="100" textAnchor="middle" fontSize="8" fill="var(--color-primary,#2563eb)" fontWeight="bold">Thread</text>
    </svg>
  )
}

// ── Dimension row ──────────────────────────────────────────────────────────────

interface DimState { value: string; lo: string; hi: string }
const emptyDim = (lo = '-5', hi = '5'): DimState => ({ value: '', lo, hi })

const inp = 'w-full rounded border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none'
const badge = 'flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold w-7 h-7 shrink-0 select-none'

function DimRow({ label, unit = 'mm', isText = false, state, onChange, svg }: {
  label: string; unit?: string; isText?: boolean
  state: DimState; onChange: (s: DimState) => void; svg: React.ReactNode
}) {
  if (isText) {
    return (
      <div className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl border border-line bg-white p-4">
        <div className="flex h-16 w-16 items-center justify-center text-ink-soft">{svg}</div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
          <input className={inp} placeholder={`e.g. ${label === 'Thread Size' ? '1/4 BSP' : '—'}`} value={state.value}
            onChange={e => onChange({ ...state, value: e.target.value })} />
        </div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[72px_1fr] items-start gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-[80px_180px_1fr_1fr] sm:items-center">
      <div className="flex h-16 w-16 items-center justify-center text-ink-soft sm:h-20 sm:w-20">{svg}</div>
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
        <div className="flex items-center gap-1.5">
          <input type="number" className={inp} placeholder="Value" value={state.value}
            onChange={e => onChange({ ...state, value: e.target.value })} />
          <span className={badge}>{unit}</span>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs text-ink-soft">Lower boundary</p>
        <div className="flex items-center gap-1.5">
          <input type="number" className={inp} placeholder="-5" value={state.lo}
            onChange={e => onChange({ ...state, lo: e.target.value })} />
          <span className={badge}>{unit}</span>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs text-ink-soft">Upper boundary</p>
        <div className="flex items-center gap-1.5">
          <input type="number" className={inp} placeholder="5" value={state.hi}
            onChange={e => onChange({ ...state, hi: e.target.value })} />
          <span className={badge}>{unit}</span>
        </div>
      </div>
    </div>
  )
}

const TOP_CAP_OPTIONS = ['','Male Thread','Male Threaded-Rod','Male single O-ring','Male double O-ring','Male Flat single O-ring','Male Angled Cone','Male Ball Joint','Male Bayonet Lock','Male Reducing','Open Hat','Female center hole','Male Protrusions']
const BOT_CAP_OPTIONS = ['','Closed','Legs','Trapezoid','Open Grille','Closed Grille','Center Hole','Interrupted Flange','Propeller']

function CapRow({ label, options, svg, state, onChange }: {
  label: string; options: string[]; svg: React.ReactNode
  state: DimState; onChange: (s: DimState) => void
}) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-[80px_1fr]">
      <div className="flex h-16 w-16 items-center justify-center text-ink-soft sm:h-20 sm:w-20">{svg}</div>
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
        <select
          className={inp + ' appearance-none'}
          value={state.value}
          onChange={e => onChange({ ...state, value: e.target.value })}
        >
          {options.map(o => <option key={o} value={o}>{o || `Any ${label}`}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── Params helpers ─────────────────────────────────────────────────────────────

type AllDims = { od: DimState; lod: DimState; idm: DimState; len: DimState; bh: DimState; micron: DimState; thread: DimState; top_cap: DimState; bot_cap: DimState }

function buildParams(dims: AllDims, category: string) {
  const p = new URLSearchParams()
  if (category) p.set('category', category)
  const addDim = (key: string, s: DimState, loKey: string, hiKey: string) => {
    if (!s.value) return
    p.set(key, s.value)
    if (s.lo) p.set(loKey, String(Math.abs(Number(s.lo))))
    if (s.hi) p.set(hiKey, s.hi)
  }
  addDim('od',  dims.od,  'od_lo',  'od_hi')
  addDim('lod', dims.lod, 'lod_lo', 'lod_hi')
  addDim('idm', dims.idm, 'idm_lo', 'idm_hi')
  addDim('len', dims.len, 'len_lo', 'len_hi')
  addDim('bh',  dims.bh,  'bh_lo',  'bh_hi')
  if (dims.micron.value)  p.set('micron',  dims.micron.value)
  if (dims.thread.value)  p.set('thread',  dims.thread.value)
  if (dims.top_cap.value) p.set('top_cap', dims.top_cap.value)
  if (dims.bot_cap.value) p.set('bot_cap', dims.bot_cap.value)
  return p
}

// ── Landing: category cards ────────────────────────────────────────────────────

function SizeLanding() {
  const meta = useMeta()
  return (
    <Container className="py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Search by Dimensions</h1>
        <p className="mt-1.5 text-sm text-ink-soft">Select a product category to search by OD, ID, Length, Thread, and more.</p>
      </div>

      {!meta ? <Spinner /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {/* All products option */}
          <Link
            to="/size-search?category=all"
            className="group overflow-hidden rounded-xl border border-line bg-white shadow-card transition-all hover:border-primary/40 hover:shadow-pop"
          >
            <div className="flex h-36 items-center justify-center bg-surface p-4">
              <svg viewBox="0 0 80 80" className="h-20 w-20 text-ink-soft/40" fill="none">
                <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="2"/>
                <circle cx="40" cy="40" r="16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
              </svg>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-ink transition-colors group-hover:text-primary">All Products</p>
              <p className="mt-0.5 text-xs text-ink-soft">Search across all categories</p>
            </div>
          </Link>

          {meta.categories.filter(c => c.product_count > 0).map(c => (
            <Link
              key={c.id}
              to={`/size-search?category=${c.slug}`}
              className="group overflow-hidden rounded-xl border border-line bg-white shadow-card transition-all hover:border-primary/40 hover:shadow-pop"
            >
              <div className="flex h-36 items-center justify-center bg-surface p-4">
                <img
                  src={c.image} alt={c.name}
                  className="h-24 w-full object-contain"
                  loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-semibold text-ink transition-colors group-hover:text-primary">{c.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{c.product_count} product{c.product_count === 1 ? '' : 's'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Container>
  )
}

// ── Search form ────────────────────────────────────────────────────────────────

function SizeSearchForm({ category }: { category: string }) {
  const meta = useMeta()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const init = (k: string, lo = '-5', hi = '5'): DimState => ({
    value: params.get(k) ?? '',
    lo: params.get(`${k}_lo`) ? `-${params.get(`${k}_lo`)}` : lo,
    hi: params.get(`${k}_hi`) ?? hi,
  })

  const [od,      setOd]      = useState<DimState>(() => init('od'))
  const [lod,     setLod]     = useState<DimState>(() => init('lod'))
  const [idm,     setIdm]     = useState<DimState>(() => init('idm'))
  const [len,     setLen]     = useState<DimState>(() => init('len'))
  const [bh,      setBh]      = useState<DimState>(() => init('bh'))
  const [micron,  setMicron]  = useState<DimState>(() => ({ value: params.get('micron')  ?? '', lo: '', hi: '' }))
  const [thread,  setThread]  = useState<DimState>(() => ({ value: params.get('thread')  ?? '', lo: '', hi: '' }))
  const [top_cap, setTopCap]  = useState<DimState>(() => ({ value: params.get('top_cap') ?? '', lo: '', hi: '' }))
  const [bot_cap, setBotCap]  = useState<DimState>(() => ({ value: params.get('bot_cap') ?? '', lo: '', hi: '' }))

  const [result, setResult] = useState<{ count: number; products: Product[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const catSlug = category === 'all' ? '' : category
  const catName = meta?.categories.find(c => c.slug === catSlug)?.name ?? (catSlug ? catSlug : 'All Products')

  const hasInitial = ['od','lod','idm','len','bh','micron','thread','top_cap','bot_cap'].some(k => params.get(k))
  useEffect(() => { if (hasInitial) doSearch() }, [])

  const doSearch = () => {
    const p = buildParams({ od, lod, idm, len, bh, micron, thread, top_cap, bot_cap }, catSlug)
    if (!['od','idm','len','micron','thread'].some(k => p.has(k))) return
    setLoading(true); setSearched(true)
    navigate(`/size-search?${p.toString()}`, { replace: true })
    getJSON<{ count: number; products: Product[] }>(`/api/dim-search?${p.toString()}`)
      .then(setResult)
      .catch(() => setResult({ count: 0, products: [] }))
      .finally(() => setLoading(false))
  }

  const reset = () => {
    setOd(emptyDim()); setLod(emptyDim()); setIdm(emptyDim())
    setLen(emptyDim()); setBh(emptyDim())
    setMicron({ value: '', lo: '', hi: '' }); setThread({ value: '', lo: '', hi: '' })
    setTopCap({ value: '', lo: '', hi: '' }); setBotCap({ value: '', lo: '', hi: '' })
    setResult(null); setSearched(false)
    navigate(`/size-search?category=${category}`, { replace: true })
  }

  const hasAny = [od, lod, idm, len, bh, micron, thread, top_cap, bot_cap].some(s => s.value.trim())

  return (
    <Container className="py-8">
      {/* Back + title */}
      <div className="mb-6">
        <Link to="/size-search" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> All categories
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Search in <span className="text-primary">{catName}</span>
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Enter a dimension value and set how much tolerance to allow above and below.
        </p>
      </div>

      <div className="space-y-3">
        <DimRow label="Outer Diameter"         svg={<SvgOD />}         state={od}     onChange={setOd} />
        <DimRow label="Largest Outer Diameter" svg={<SvgLargestOD />}  state={lod}    onChange={setLod} />
        <DimRow label="Total Height"           svg={<SvgLength />}     state={len}    onChange={setLen} />
        <DimRow label="Body Height"            svg={<SvgBodyHeight />} state={bh}     onChange={setBh} />
        <DimRow label="Inner Diameter"         svg={<SvgID />}         state={idm}    onChange={setIdm} />
        <DimRow label="Micron Rating" unit="µ" svg={<SvgMicron />}
          state={micron} onChange={s => setMicron({ ...s, lo: '', hi: '' })} />
        <DimRow label="Thread Size" isText svg={<SvgThread />} state={thread} onChange={setThread} />
        <CapRow label="Top Cap"    options={TOP_CAP_OPTIONS} svg={<SvgThread />} state={top_cap} onChange={setTopCap} />
        <CapRow label="Bottom Cap" options={BOT_CAP_OPTIONS} svg={<SvgThread />} state={bot_cap} onChange={setBotCap} />
      </div>

      <div className="sticky bottom-20 z-30 mt-6 flex items-center gap-3 rounded-xl border border-line bg-white/95 p-3 shadow-pop backdrop-blur">
        <button
          onClick={doSearch}
          disabled={!hasAny || loading}
          className="flex-1 rounded-lg bg-accent px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-dark disabled:opacity-40 sm:flex-none"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
        {hasAny && (
          <button onClick={reset} className="text-sm text-ink-soft hover:text-ink hover:underline">Clear all</button>
        )}
      </div>

      {loading && <div className="mt-10"><Spinner label="Searching…" /></div>}

      {!loading && searched && result && (
        <div className="mt-10">
          <div className="mb-5 border-b border-line pb-4">
            <p className="text-lg font-bold">
              <span className="text-ink">{result.count}</span>
              <span className="font-normal text-ink-soft"> result{result.count === 1 ? '' : 's'} in {catName}</span>
            </p>
          </div>
          {result.products.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
              {result.products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-white px-6 py-12 text-center text-ink-soft">
              No products found for these dimensions. Try widening the tolerance values.
            </div>
          )}
        </div>
      )}
    </Container>
  )
}

// ── Router: landing vs. form ───────────────────────────────────────────────────

export function DimensionSearch() {
  const [params] = useSearchParams()
  const category = params.get('category')
  if (!category) return <SizeLanding />
  return <SizeSearchForm category={category} />
}
