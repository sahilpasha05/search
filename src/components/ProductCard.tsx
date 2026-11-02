import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Product } from '../lib/api'
import { AvailabilityBadge } from './ui'

function specLine(p: Product): string {
  const s: string[] = []
  if (p.material) s.push(p.material)
  if (p.outer_diameter) s.push(`OD ${p.outer_diameter} mm`)
  if (p.inner_diameter) s.push(`ID ${p.inner_diameter} mm`)
  if (p.length_mm) s.push(`L ${p.length_mm} mm`)
  if (p.micron != null) s.push(`${p.micron} µ`)
  return s.join(' · ')
}

export function ProductCard({ product: p }: { product: Product }) {
  const description = p.description?.trim() || specLine(p)
  const href = `/products/${p.id}${p.matched_part ? `?oem=${encodeURIComponent(p.matched_part)}` : ''}`

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-all duration-150 hover:border-primary/40 hover:shadow-card">
      <Link to={href} className="relative flex aspect-square w-full items-center justify-center bg-white p-2 sm:aspect-[4/3] sm:p-3">
        <img src={p.image} alt={p.name} className="max-h-full max-w-full object-contain" loading="lazy" />
        <span className="absolute left-1.5 top-1.5 scale-90 origin-top-left sm:left-3 sm:top-3 sm:scale-100">
          <AvailabilityBadge value={p.availability} />
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-primary sm:text-sm">{p.code}</span>
          {p.category && (
            <span className="truncate rounded bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-soft">{p.category}</span>
          )}
        </div>
        <Link to={href} className="mt-1 line-clamp-2 text-xs font-semibold sm:mt-1.5 sm:text-sm leading-snug transition-colors group-hover:text-primary">
          {p.name}
        </Link>

        {description && <p className="mt-1.5 line-clamp-2 text-[11px] sm:line-clamp-3 sm:text-xs text-ink-soft">{description}</p>}

        <div className="mt-3">
          {p.rate != null
            ? <span className="text-sm font-bold text-ink">₹{Number(p.rate).toLocaleString('en-IN')}</span>
            : <span className="text-xs font-medium text-ink-soft">Price on request</span>}
        </div>

        <div className="mt-auto pt-3">
          <Link
            to={href}
            className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary/8 px-2 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white sm:px-3 sm:py-2 sm:text-xs"
          >
            View Details
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
