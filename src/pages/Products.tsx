import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { getJSON, useDebounced, useMeta, type Product } from '../lib/api'
import { ProductCard } from '../components/ProductCard'
import { FiltersPanel, emptyFilters, type ListFilters } from '../components/FiltersPanel'
import { Container, EmptyState, Spinner, inputCls } from '../components/ui'

export function Products() {
  const [params, setParams] = useSearchParams()
  const meta = useMeta()
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [filters, setFilters] = useState<ListFilters>({ ...emptyFilters, category: params.get('category') ?? '' })
  const [drawer, setDrawer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])

  // keep category param → filter in sync when arriving from category links
  useEffect(() => {
    const cat = params.get('category') ?? ''
    setFilters((f) => (f.category === cat ? f : { ...f, category: cat }))
  }, [params])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (dq) p.set('q', dq)
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }, [dq, filters])

  useEffect(() => {
    setLoading(true)
    getJSON<{ products: Product[] }>(`/api/products?${qs}`)
      .then((r) => setProducts(r.products))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [qs])

  const activeCategory = meta?.categories.find((c) => c.slug === filters.category)

  const updateFilters = (f: ListFilters) => {
    setFilters(f)
    if (f.category !== (params.get('category') ?? '')) {
      setParams(f.category ? { category: f.category } : {}, { replace: true })
    }
  }

  return (
    <Container className="py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {activeCategory ? activeCategory.name : 'All Products'}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink-soft">
            {activeCategory?.description || 'Browse the complete FilterCore catalogue of industrial filtration products.'}
          </p>
        </div>
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{loading ? '…' : products.length}</span> products
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-soft/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by product name or code…"
            className={`${inputCls} pl-10`}
          />
        </div>
        <button
          onClick={() => setDrawer(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-line p-5 shadow-card">
            <FiltersPanel filters={filters} onChange={updateFilters} />
          </div>
        </aside>
        <div>
          {loading && <Spinner />}
          {!loading && products.length === 0 && <EmptyState query={dq || undefined} />}
          {!loading && products.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 animate-fade-in">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-ink/40 animate-fade-in" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5 pb-10 shadow-pop animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Refine Products</h3>
              <button onClick={() => setDrawer(false)} aria-label="Close filters" className="rounded-lg p-2 text-ink-soft hover:bg-surface">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FiltersPanel filters={filters} onChange={updateFilters} />
            <button
              onClick={() => setDrawer(false)}
              className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Show {products.length} Products
            </button>
          </div>
        </div>
      )}
    </Container>
  )
}
