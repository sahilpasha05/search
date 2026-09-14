import { Loader2, SearchX } from 'lucide-react'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-soft">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function AvailabilityBadge({ value }: { value: string }) {
  const inStock = value === 'In Stock'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {value}
    </span>
  )
}

export function PartTypeBadge({ type }: { type: string }) {
  const style =
    type === 'OEM'
      ? 'bg-primary-light text-primary'
      : type === 'Alternative'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-surface text-ink-soft'
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}>{type}</span>
}

export function EmptyState({ query }: { query?: string }) {
  return (
    <div className="animate-fade-in rounded-2xl border border-line bg-surface px-6 py-14 text-center">
      <SearchX className="mx-auto h-10 w-10 text-ink-soft/50" />
      <h3 className="mt-4 text-lg font-semibold">No exact match found{query ? ` for “${query}”` : ''}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        Try searching by another part number, manufacturer, category, or product size. Partial part
        numbers work too — for example, <span className="font-medium text-ink">C14200</span> will
        also find <span className="font-medium text-ink">C-14200</span>.
      </p>
    </div>
  )
}

/** Consistent page-width wrapper */
export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50'
export const btnAccent =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50'
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
export const inputCls =
  'w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
export const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft'
