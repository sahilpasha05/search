import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { getJSON, type Product } from '../lib/api'
import { HomeSearch, CategoryGrid } from '../components/HomeSearch'
import { ProductCard } from '../components/ProductCard'
import { FiltersPanel, emptyFilters, type ListFilters } from '../components/FiltersPanel'
import { Container, EmptyState, Spinner } from '../components/ui'
import { useQuote } from '../components/QuoteContext'
import type { GasketRow, GasketData } from './Gaskets'

const inr = (v: number | null) => (v == null ? '—' : `₹ ${v}`)

export function Home() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const mode = params.get('mode') ?? 'part'
  const [filters, setFilters] = useState<ListFilters>(emptyFilters)
  const [drawer, setDrawer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number; products: Product[]; fuzzy?: boolean } | null>(null)
  const [gasketResult, setGasketResult] = useState<GasketData | null>(null)
  const { openQuote } = useQuote()

  const hasQuery = mode === 'size'
    ? ['od', 'idm', 'len', 'micron', 'thread', 'material', 'filterType', 'category'].some((k) => params.get(k))
    : q.trim() !== ''

  const filterQS = useMemo(() => {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }, [filters])

  useEffect(() => {
    if (!hasQuery) { setResult(null); setGasketResult(null); return }
    setLoading(true)

    if (mode === 'size') {
      // Size search — filters only
      setGasketResult(null)
      getJSON<{ count: number; products: Product[]; fuzzy?: boolean }>(
        `/api/size-search?${params.toString()}${filterQS ? '&' + filterQS : ''}`
      )
        .then(setResult)
        .catch(() => setResult({ count: 0, products: [] }))
        .finally(() => setLoading(false))
    } else {
      // Text search — filters + gaskets in parallel
      Promise.all([
        getJSON<{ count: number; products: Product[]; fuzzy?: boolean }>(
          `/api/search?q=${encodeURIComponent(q)}${filterQS ? '&' + filterQS : ''}`
        ).catch(() => ({ count: 0, products: [] as Product[], fuzzy: false })),
        getJSON<GasketData>(
          `/api/gaskets?q=${encodeURIComponent(q)}`
        ).catch(() => ({ count: 0, models: [] })),
      ]).then(([filterRes, gasketRes]) => {
        setResult(filterRes)
        setGasketResult(gasketRes.count > 0 ? gasketRes : null)
      }).finally(() => setLoading(false))
    }
  }, [q, mode, params, filterQS, hasQuery])

  const sizeSummary = useMemo(() => {
    if (mode !== 'size') return ''
    const parts: string[] = []
    if (params.get('od')) parts.push(`OD ${params.get('od')} mm`)
    if (params.get('idm')) parts.push(`ID ${params.get('idm')} mm`)
    if (params.get('len')) parts.push(`L ${params.get('len')} mm`)
    if (params.get('micron')) parts.push(`≤ ${params.get('micron')} µ`)
    if (params.get('thread')) parts.push(`thread ${params.get('thread')}`)
    return parts.join(' · ')
  }, [mode, params])

  const totalCount = (result?.count ?? 0) + (gasketResult?.count ?? 0)

  return (
    <Container className="py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Search in our catalog</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Search by part number, OEM cross-reference, dimensions, or browse by category.
        </p>
      </div>

      <HomeSearch />

      {hasQuery && (
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-bold sm:text-xl">
                Search Results
                {q && <span className="font-normal text-ink-soft"> for "{q}"</span>}
              </h2>
              {sizeSummary && <p className="mt-0.5 font-mono text-xs text-ink-soft">{sizeSummary}</p>}
              {!loading && (
                <p className="mt-1 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{totalCount}</span> matching result{totalCount === 1 ? '' : 's'}
                  {gasketResult && result && result.count > 0 && (
                    <span className="ml-2 text-ink-soft">
                      ({result.count} filter{result.count === 1 ? '' : 's'}, {gasketResult.count} gasket{gasketResult.count === 1 ? '' : 's'})
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={() => setDrawer(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
          </div>

          {loading && <Spinner label="Searching…" />}

          {!loading && (
            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
              <aside className="hidden lg:block">
                <div className="sticky top-24 rounded-2xl border border-line p-5 shadow-card">
                  <FiltersPanel filters={filters} onChange={setFilters} />
                </div>
              </aside>

              <div className="min-w-0">
                {result?.fuzzy && (
                  <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-fade-in">
                    No exact match for <span className="font-mono font-semibold">"{q}"</span> — showing{' '}
                    <span className="font-semibold">close matches</span>. Please double-check before confirming.
                  </div>
                )}

                {/* Filter products */}
                {result && result.products.length > 0 && (
                  <div className="animate-fade-in">
                    {gasketResult && (
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                        Filters &amp; Products
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {result.products.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                  </div>
                )}

                {/* Gasket results */}
                {gasketResult && gasketResult.models.length > 0 && (
                  <div className={`animate-fade-in ${result && result.products.length > 0 ? 'mt-10' : ''}`}>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                      Gaskets &amp; Dies
                    </p>
                    {gasketResult.models.map(({ model, items }) => (
                      <div key={model} className="mb-6">
                        <div className="flex items-center justify-between rounded-t-xl bg-primary px-4 py-2">
                          <span className="text-sm font-bold text-white">Model {model}</span>
                          <span className="text-xs text-white/70">{items.length} part{items.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="divide-y divide-line rounded-b-xl border border-t-0 border-line bg-white">
                          {items.map((g: GasketRow) => (
                            <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                              <img
                                src={g.image || '/img/cat-gasket.svg'}
                                alt={g.part_no}
                                className="h-10 w-14 shrink-0 rounded-md border border-line bg-surface object-cover"
                                loading="lazy"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm font-bold text-ink">{g.part_no}</span>
                                  {g.die_no && (
                                    <span className="rounded bg-primary-light px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                                      {g.die_no}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 truncate text-xs text-ink-soft">{g.description}</p>
                                {g.ccn && <p className="text-[11px] text-ink-soft">CCN: <span className="font-mono text-ink">{g.ccn}</span></p>}
                              </div>
                              <div className="shrink-0 text-right">
                                {g.rate != null && <p className="text-sm font-semibold text-ink">{inr(g.rate)}</p>}
                                <button
                                  onClick={() => openQuote({ product: `Gasket ${g.part_no} — ${g.description} (Model ${g.model}, Die ${g.die_no})`, partNumber: g.ccn })}
                                  className="mt-1 rounded-md bg-accent px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent-dark"
                                >
                                  Quote
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Link to={`/gaskets?q=${encodeURIComponent(q)}`} className="text-xs font-medium text-primary hover:underline">
                      View full gaskets catalogue →
                    </Link>
                  </div>
                )}

                {/* Empty state */}
                {result && result.products.length === 0 && !gasketResult && (
                  <EmptyState query={q || undefined} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasQuery && (
        <div className="mt-12">
          <CategoryGrid />
        </div>
      )}

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-ink/40 animate-fade-in" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5 pb-10 shadow-pop animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Refine Results</h3>
              <button onClick={() => setDrawer(false)} aria-label="Close filters" className="rounded-lg p-2 text-ink-soft hover:bg-surface">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FiltersPanel filters={filters} onChange={setFilters} />
            <button
              onClick={() => setDrawer(false)}
              className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Show Results
            </button>
          </div>
        </div>
      )}
    </Container>
  )
}
