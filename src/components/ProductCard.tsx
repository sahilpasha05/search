import { Link } from 'react-router-dom'
import { ArrowUpRight, Link2 } from 'lucide-react'
import type { Product } from '../lib/api'
import { AvailabilityBadge } from './ui'

function keySpecs(p: Product): string[] {
  const s: string[] = []
  if (p.outer_diameter) s.push(`OD ${p.outer_diameter} mm`)
  if (p.inner_diameter) s.push(`ID ${p.inner_diameter} mm`)
  if (p.length_mm) s.push(`L ${p.length_mm} mm`)
  if (p.micron != null) s.push(`${p.micron} µ`)
  return s.slice(0, 4)
}

export function ProductCard({ product: p }: { product: Product }) {
  const oem = p.part_numbers?.find((n) => n.type === 'OEM') ?? p.part_numbers?.[0]

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-all duration-150 hover:border-primary/40 hover:shadow-card">
      <Link to={`/products/${p.id}`} className="relative block bg-surface">
        <img src={p.image} alt={p.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
        <span className="absolute left-3 top-3">
          <AvailabilityBadge value={p.availability} />
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-ink-soft">{p.manufacturer ?? '—'}</p>
        <Link to={`/products/${p.id}`} className="mt-1 line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
          {p.name}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          {oem && <span className="font-mono font-medium text-ink">{p.matched_part ?? oem.number}</span>}
          <span className="inline-flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            {p.part_count} cross-refs
          </span>
        </div>

        {keySpecs(p).length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {keySpecs(p).map((s) => (
              <span key={s} className="rounded bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-soft">{s}</span>
            ))}
          </div>
        )}

        <div className="mt-3">
          {p.rate != null
            ? <span className="text-sm font-bold text-ink">₹{Number(p.rate).toLocaleString('en-IN')}</span>
            : <span className="text-xs font-medium text-ink-soft">Price on request</span>}
        </div>

        <div className="mt-auto pt-3">
          <Link
            to={`/products/${p.id}`}
            className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary/8 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            View Details
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
