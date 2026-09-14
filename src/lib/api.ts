import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PartNumber {
  id: number
  number: string
  type: 'OEM' | 'Cross Reference' | 'Alternative' | string
  maker: string
}

export interface Product {
  id: number
  name: string
  code: string
  manufacturer: string | null
  category: string | null
  category_slug: string | null
  description: string
  image: string
  filter_type: string
  material: string
  availability: string
  outer_diameter: number | null
  inner_diameter: number | null
  largest_od: number | null
  body_height: number | null
  length_mm: number | null
  thread: string
  micron: number | null
  top_cap: string | null
  bottom_cap: string | null
  connection_type: string
  pressure_rating: string
  rate: number | null
  part_count: number
  part_numbers: PartNumber[]
  matched_part?: string
  match_distance?: number
  // detail-only fields
  specs?: { name: string; value: string }[]
  images?: string[]
  models?: { model: string; manufacturer: string }[]
  applications?: string[]
  related?: Product[]
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  image: string
  product_count: number
}

export interface Manufacturer {
  id: number
  name: string
  product_count: number
}

export interface Meta {
  categories: Category[]
  manufacturers: Manufacturer[]
  filterTypes: string[]
  materials: string[]
}

export interface Suggestion {
  number: string
  type: string
  maker: string
  product_id: number
  product_name: string
  approx?: boolean
}

export interface QuoteRequest {
  id: number
  name: string
  company: string
  email: string
  phone: string
  product: string
  part_number: string
  quantity: string
  message: string
  status: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`)
  return res.json()
}

export async function sendJSON<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
  return data as T
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

let metaCache: Meta | null = null

export function useMeta(): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(metaCache)
  useEffect(() => {
    if (metaCache) return
    getJSON<Meta>('/api/meta').then((m) => { metaCache = m; setMeta(m) }).catch(() => {})
  }, [])
  return meta
}

/** Invalidate the meta cache (after admin edits). */
export function refreshMeta() { metaCache = null }

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
