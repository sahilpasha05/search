import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ChevronRight, Printer } from 'lucide-react'
import { getJSON, type Product } from '../lib/api'
import { AvailabilityBadge, Container, Spinner } from '../components/ui'
import { ProductCard } from '../components/ProductCard'

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-6 border-b border-line px-4 py-3 text-sm last:border-0 odd:bg-surface/60">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

export function ProductDetails() {
  const { id } = useParams()
  const location = useLocation()
  const [p, setP] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)

  useEffect(() => {
    setP(null); setNotFound(false); setImgIdx(0)
    getJSON<Product>(`/api/products/${id}`).then(setP).catch(() => setNotFound(true))
  }, [id])

  if (notFound) {
    return (
      <Container className="py-24 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link to="/products" className="mt-4 inline-block text-primary hover:underline">Browse all products</Link>
      </Container>
    )
  }
  if (!p) return <Spinner />

  const images = p.images?.length ? p.images : [p.image]
  const oemNo = new URLSearchParams(location.search).get('oem')
  const description = p.description?.trim() || [p.material, p.outer_diameter && `OD ${p.outer_diameter} mm`, p.inner_diameter && `ID ${p.inner_diameter} mm`, p.length_mm && `L ${p.length_mm} mm`, p.micron != null && `${p.micron} µ`].filter(Boolean).join(' · ')

  return (
    <Container className="py-8">
      {/* Breadcrumbs */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
        <Link to="/" className="hover:text-primary">Search</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/products" className="hover:text-primary">Products</Link>
        {p.category && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link to={`/products?category=${p.category_slug}`} className="hover:text-primary">{p.category}</Link>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-ink">{p.code}</span>
      </nav>

      {/* Top: gallery + summary */}
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-4">
            <img src={images[imgIdx]} alt={p.name} className="max-h-full max-w-full object-contain" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`flex h-16 w-20 items-center justify-center overflow-hidden rounded-lg border-2 bg-white p-1 transition-colors ${i === imgIdx ? 'border-primary' : 'border-line hover:border-primary/40'}`}
                >
                  <img src={img} alt="" className="max-h-full max-w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{p.name || p.code}</h1>
            <button
              onClick={() => window.print()}
              className="no-print mt-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-soft hover:border-primary/50 hover:text-primary transition-colors"
              title="Print / Save as PDF"
            >
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            <SpecRow label="Category" value={p.category} />
            <SpecRow label="OEM Part Number" value={oemNo && <span className="font-mono">{oemNo}</span>} />
            <SpecRow label="SC Code" value={<span className="font-mono font-semibold">{p.code}</span>} />
            <SpecRow label="Description" value={description} />
            <SpecRow label="Rate" value={p.rate != null ? `₹${Number(p.rate).toLocaleString('en-IN')}` : 'Price on request'} />
            <SpecRow label="Stock" value={<AvailabilityBadge value={p.availability} />} />
          </div>
        </div>
      </div>

      {/* Specifications + Cross-refs */}
      <section className="mt-12 grid grid-cols-1 gap-10">
        <div>
          <h2 className="text-base font-bold text-ink">Specifications</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <SpecRow label="Filter Type" value={p.filter_type} />
            <SpecRow label="Outer Diameter" value={p.outer_diameter ? `${p.outer_diameter} mm` : ''} />
            <SpecRow label="Inner Diameter" value={p.inner_diameter ? `${p.inner_diameter} mm` : ''} />
            <SpecRow label="Length / Height" value={p.length_mm ? `${p.length_mm} mm` : ''} />
            <SpecRow label="Thread" value={p.thread} />
            <SpecRow label="Micron Rating" value={p.micron != null ? `${p.micron} µ` : ''} />
            <SpecRow label="Material" value={p.material} />
            <SpecRow label="Connection" value={p.connection_type} />
            <SpecRow label="Pressure Rating" value={p.pressure_rating !== '—' ? p.pressure_rating : ''} />
            {p.specs?.map((s) => <SpecRow key={s.name} label={s.name} value={s.value} />)}
          </div>

          {(p.models?.length ?? 0) > 0 && (
            <>
              <h2 className="mt-8 text-base font-bold text-ink">Compatible Models</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.models!.map((m, i) => (
                  <span key={i} className="rounded-md bg-surface border border-line px-3 py-1.5 text-xs font-medium">
                    {m.model}{m.manufacturer && <span className="text-ink-soft"> · {m.manufacturer}</span>}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

      </section>

      {/* Related */}
      {(p.related?.length ?? 0) > 0 && (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-base font-bold text-ink">Related Products in {p.category}</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.related!.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}
    </Container>
  )
}
