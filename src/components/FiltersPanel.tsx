import { X } from 'lucide-react'
import { useMeta } from '../lib/api'
import { labelCls, inputCls } from './ui'

export interface ListFilters {
  category: string
  manufacturer: string
  filterType: string
  availability: string
  micron: string
}

export const emptyFilters: ListFilters = { category: '', manufacturer: '', filterType: '', availability: '', micron: '' }

export function FiltersPanel({
  filters,
  onChange,
}: {
  filters: ListFilters
  onChange: (f: ListFilters) => void
}) {
  const meta = useMeta()
  const set = (k: keyof ListFilters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange({ ...filters, [k]: e.target.value })
  const selectCls = inputCls + ' appearance-none'
  const active = Object.values(filters).some((v) => v !== '')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide">Filters</h3>
        {active && (
          <button
            onClick={() => onChange(emptyFilters)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>
      <div>
        <label className={labelCls}>Category</label>
        <select className={selectCls} value={filters.category} onChange={set('category')}>
          <option value="">All categories</option>
          {meta?.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Manufacturer</label>
        <select className={selectCls} value={filters.manufacturer} onChange={set('manufacturer')}>
          <option value="">All manufacturers</option>
          {meta?.manufacturers.filter((m) => m.product_count > 0).map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Product Type</label>
        <select className={selectCls} value={filters.filterType} onChange={set('filterType')}>
          <option value="">All types</option>
          {meta?.filterTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Max Micron Rating</label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="e.g. 10"
          className={inputCls}
          value={filters.micron}
          onChange={set('micron')}
        />
      </div>
      <div>
        <label className={labelCls}>Availability</label>
        <select className={selectCls} value={filters.availability} onChange={set('availability')}>
          <option value="">Any</option>
          <option value="In Stock">In Stock</option>
          <option value="On Request">On Request</option>
        </select>
      </div>
    </div>
  )
}
