import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { getJSON, type Product } from '../lib/api'
import { SearchModule, type SearchTab } from '../components/SearchModule'
import { ProductCard } from '../components/ProductCard'
import { FiltersPanel, emptyFilters, type ListFilters } from '../components/FiltersPanel'
import { Container, EmptyState, Spinner } from '../components/ui'

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const mode = params.get('mode') ?? 'part'
  const [filters, setFilters] = useState<ListFilters>(emptyFilters)
  const [drawer, setDrawer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number; products: Product[]; fuzzy?: boolean } | null>(null)

  const hasQuery = mode === 'size'
    ? ['od', 'idm', 'len', 'micron', 'thread', 'material', 'filterType', 'category'].some((k) => params.get(k))
    : q.trim() !== ''

  const filterQS = useMemo(() => {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }, [filters])

  useEffect(() => {
    if (!hasQuery) { setResult(null); return }
    setLoading(true)
    const url =
      mode === 'size'
        ? `/api/size-search?${params.toString()}${filterQS ? '&' + filterQS : ''}`
        : `/api/search?q=${encodeURIComponent(q)}${filterQS ? '&' + filterQS : ''}`
    getJSON<{ count: number; products: Product[]; fuzzy?: boolean }>(url)
      .then(setResult)
      .catch(() => setResult({ count: 0, products: [] }))
      .finally(() => setLoading(false))
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

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">SC Filter Search</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Search by OEM part number, cross-reference, size or category — partial and hyphen-free numbers matched automatically.
      </p>

      <div className="mt-6">
        <SearchModule initialTab={(mode === 'size' ? 'size' : 'part') as SearchTab} compact />
      </div>

      {hasQuery && (
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-bold sm:text-xl">
                Search Results
                {q && <span className="font-normal text-ink-soft"> for "{q}"</span>}
              </h2>
              {sizeSummary && <p className="mt-0.5 font-mono text-xs text-ink-soft">{sizeSummary}</p>}
              {result && !loading && (
                <p className="mt-1 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{result.count}</span> matching product{result.count === 1 ? '' : 's'}
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

          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-line p-5 shadow-card">
                <FiltersPanel filters={filters} onChange={setFilters} />
              </div>
            </aside>

            <div>
              {!loading && result?.fuzzy && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-fade-in">
                  No exact match for <span className="font-mono font-semibold">"{q}"</span> — showing{' '}
                  <span className="font-semibold">close matches</span> (possible typo). Please double-check
                  the part number before confirming.
                </div>
              )}
              {loading && <Spinner label="Searching…" />}
              {!loading && result && result.products.length === 0 && <EmptyState query={q || undefined} />}
              {!loading && result && result.products.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3 animate-fade-in">
                  {result.products.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile filter drawer */}
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
