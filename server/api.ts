import express, { type Express } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { db, normalize } from './db.js'
import { editDistance, fuzzyMax } from './fuzzy.js'
import { authRouter, requireAuth, requireAdmin } from './auth.js'
import { startFileWatchers, syncFilters, syncGaskets, syncState, FILTER_XLSX, GASKET_XLSX } from './sync.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip internal-only fields (rate) before sending to the client. */
function stripInternal<T extends { rate?: unknown }>(products: T[]): T[] {
  for (const p of products) delete (p as any).rate
  return products
}

/** Ensure manufacturer exists; return its id. Cached within a request. */
async function ensureManufacturer(name: string, cache: Map<string, number | null>): Promise<number | null> {
  if (!name) return null
  if (cache.has(name)) return cache.get(name)!
  const { data } = await db.from('manufacturers')
    .upsert({ name }, { onConflict: 'name' }).select('id').single()
  const id = data?.id ?? null
  cache.set(name, id)
  return id
}

/** Ensure category exists; return its id. Cached within a request. */
async function ensureCategory(name: string, cache: Map<string, number | null>): Promise<number | null> {
  if (!name) return null
  if (cache.has(name)) return cache.get(name)!
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const { data } = await db.from('categories')
    .upsert({ name, slug, image: '/img/cat-process.svg' }, { onConflict: 'name' }).select('id').single()
  const id = data?.id ?? null
  cache.set(name, id)
  return id
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** For a query like "sc1", return ["sc1","sc01","sc001","sc0001"] so leading-zero
 *  variants of SC catalog codes all get hit. Works both ways: sc01 → sc1 too. */
function scCodeVariants(q: string): string[] {
  const m = q.match(/^([a-zA-Z]{1,6})(\d{1,6})$/i)
  if (!m) return [q]
  const [, prefix, digits] = m
  const num = parseInt(digits, 10)
  const s = new Set<string>()
  s.add(`${prefix}${num}`)                               // sc1
  s.add(`${prefix}${String(num).padStart(2, '0')}`)     // sc01
  s.add(`${prefix}${String(num).padStart(3, '0')}`)     // sc001
  s.add(`${prefix}${String(num).padStart(4, '0')}`)     // sc0001
  s.add(`${prefix}${digits}`)                            // original as typed
  return [...s]
}

// ---------------------------------------------------------------------------
// Manufacturer in-memory cache — avoids a DB round-trip on every search request.
// Manufacturers rarely change; 5-minute TTL is fine.
// ---------------------------------------------------------------------------
let _mfrCache: { id: number; name: string }[] = []
let _mfrCacheTs = 0
const MFR_TTL_MS = 5 * 60 * 1000

async function getCachedManufacturers(): Promise<{ id: number; name: string }[]> {
  if (Date.now() - _mfrCacheTs < MFR_TTL_MS) return _mfrCache
  const { data } = await db.from('manufacturers').select('id,name').order('name')
  _mfrCache = (data ?? []) as { id: number; name: string }[]
  _mfrCacheTs = Date.now()
  return _mfrCache
}

/** Returns manufacturer ids whose name contains q (case-insensitive). Sync after first load. */
function mfrIdsFor(mfrs: { id: number; name: string }[], q: string): number[] {
  const ql = q.toLowerCase()
  return mfrs.filter(m => m.name.toLowerCase().includes(ql)).map(m => m.id)
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function createApi(): Express {
  const app = express()
  app.use(express.json({ limit: '20mb' }))

  app.use('/api/auth', authRouter)

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

  app.use('/api', requireAuth)

  // ── meta ────────────────────────────────────────────────────────────────────
  app.get('/api/meta', async (_req, res) => {
    const [{ data: cats }, { data: mfrs }, { data: ftRows }, { data: matRows }] = await Promise.all([
      db.from('categories').select('*, products(count)').order('name'),
      db.from('manufacturers').select('*, products(count)').order('name'),
      db.from('products').select('filter_type').neq('filter_type', '').order('filter_type').limit(500),
      db.from('products').select('material').neq('material', '').order('material').limit(500),
    ])
    const uniq = <T>(arr: T[]) => [...new Set(arr)]
    res.json({
      categories: (cats ?? []).map((c: any) => ({ ...c, product_count: c.products?.[0]?.count ?? 0 })),
      manufacturers: (mfrs ?? []).map((m: any) => ({ ...m, product_count: m.products?.[0]?.count ?? 0 })),
      filterTypes: uniq((ftRows ?? []).map((r: any) => r.filter_type).filter(Boolean)),
      materials: uniq((matRows ?? []).map((r: any) => r.material).filter(Boolean)),
    })
  })

  // ── suggest-models (typeahead for Application search) ──────────────────────
  app.get('/api/suggest-models', async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    if (q.length < 1) return res.json({ models: [] })
    const { data, error } = await db.from('compatible_models')
      .select('model,manufacturer')
      .ilike('model', `%${q}%`)
      .order('model')
      .limit(200)
    if (error) return res.status(500).json({ error: error.message })
    // Deduplicate model names, preserve manufacturer label
    const seen = new Set<string>()
    const models: { model: string; manufacturer: string }[] = []
    for (const r of (data ?? []) as any[]) {
      if (!seen.has(r.model)) { seen.add(r.model); models.push({ model: r.model, manufacturer: r.manufacturer ?? '' }) }
    }
    res.json({ models: models.slice(0, 12) })
  })

  // ── suggest (typeahead) ─────────────────────────────────────────────────────
  app.get('/api/suggest', async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    const mode = String(req.query.mode ?? '')
    if (q.length < 2) return res.json({ suggestions: [], products: [] })
    const norm = normalize(q)

    // Application mode: match by product name, manufacturer, and compatible machine model
    if (mode === 'app') {
      const allMfrs = await getCachedManufacturers()
      const mfrMatchIds = mfrIdsFor(allMfrs, q)
      const [{ data: nameMatches }, { data: mfrProdsRaw }, { data: modelRows }] = await Promise.all([
        db.from('products').select('id,name,code')
          .ilike('name', `%${q}%`)
          .order('name')
          .limit(8),
        mfrMatchIds.length > 0
          ? db.from('products').select('id,name,code').in('manufacturer_id', mfrMatchIds).order('name').limit(6)
          : Promise.resolve({ data: [] }),
        db.from('compatible_models')
          .select('product_id,model,products(id,name,code)')
          .ilike('model', `%${q}%`)
          .limit(8),
      ])
      const finalProducts = [...(nameMatches ?? [])]
      const seenProdIds = new Set(finalProducts.map((p: any) => p.id))
      for (const p of mfrProdsRaw ?? []) {
        if (!seenProdIds.has((p as any).id)) { finalProducts.push(p as any); seenProdIds.add((p as any).id) }
      }
      for (const m of modelRows ?? []) {
        const p = (m as any).products
        if (p && !seenProdIds.has(p.id)) { finalProducts.push(p); seenProdIds.add(p.id) }
      }
      return res.json({ suggestions: [], products: finalProducts.slice(0, 8) })
    }

    const nz = norm.replace(/0/g, '')
    const useNz = nz.length >= 3

    // Direct part number match
    let pnQuery = db.from('part_numbers')
      .select('number,type,maker,product_id,products(name)')
      .ilike('normalized', `%${norm}%`)
      .limit(8)

    const qWithHyphen = q.replace(/^([a-zA-Z]+)(\d)/, '$1-$2')
    const codeVars = scCodeVariants(q)
    const codeOrSuggest = [
      ...codeVars.map(v => `code.ilike.${v}%`),
      `code.ilike.${qWithHyphen}%`,
      `name.ilike.%${q}%`,
    ].join(',')

    // Resolve manufacturer IDs from cache (no extra DB hit after first load)
    const allMfrs = await getCachedManufacturers()
    const mfrMatchIds = mfrIdsFor(allMfrs, q)

    const [{ data: directPn }, { data: prodSuggest }, { data: mfrProdsRaw }] = await Promise.all([
      pnQuery,
      db.from('products').select('id,name,code')
        .or(codeOrSuggest)
        .order('code')
        .limit(6),
      mfrMatchIds.length > 0
        ? db.from('products').select('id,name,code').in('manufacturer_id', mfrMatchIds).order('code').limit(6)
        : Promise.resolve({ data: [] }),
    ])

    let rows = (directPn ?? []).map((r: any) => ({
      number: r.number, type: r.type, maker: r.maker,
      product_id: r.product_id, product_name: r.products?.name ?? '',
    }))

    // Zero-matcher: try without zeros too
    if (useNz && rows.length < 8) {
      const { data: nzRows } = await db.from('part_numbers')
        .select('number,type,maker,product_id,products(name)')
        .ilike('normalized', `%${nz}%`)
        .not('normalized', 'ilike', `%${norm}%`)
        .limit(8 - rows.length)
      for (const r of nzRows ?? []) {
        rows.push({ number: r.number, type: r.type, maker: r.maker, product_id: r.product_id, product_name: (r as any).products?.name ?? '' })
      }
    }

    // Include siblings from matched products
    const ids = [...new Set(rows.map((r) => r.product_id))]
    if (ids.length > 0 && rows.length < 8) {
      const { data: siblings } = await db.from('part_numbers')
        .select('number,type,maker,product_id,products(name)')
        .in('product_id', ids)
        .order('type').limit(12)
      const seen = new Set(rows.map((r) => r.number))
      for (const s of siblings ?? []) {
        if (!seen.has(s.number)) {
          rows.push({ number: s.number, type: s.type, maker: s.maker, product_id: s.product_id, product_name: (s as any).products?.name ?? '' })
          seen.add(s.number)
        }
      }
      rows = rows.slice(0, 8)
    }

    // Fuzzy fallback via RPC
    if (rows.length === 0) {
      const { data: fuzzy } = await db.rpc('fuzzy_part_search', { q: norm, max_results: 6 })
      if ((fuzzy as any[])?.length) {
        const fIds = (fuzzy as any[]).map((f) => f.product_id)
        const { data: prods } = await db.from('products').select('id,name').in('id', fIds)
        const prodMap = new Map((prods ?? []).map((p: any) => [p.id, p.name]))
        const { data: pns } = await db.from('part_numbers').select('product_id,number,type,maker').in('product_id', fIds)
        const pnMap = new Map((pns ?? []).map((p: any) => [`${p.product_id}:${p.number}`, p]))
        rows = (fuzzy as any[]).slice(0, 6).map((m) => {
          const pn = pnMap.get(`${m.product_id}:${m.number}`)
          return { number: m.number, type: pn?.type ?? '', maker: pn?.maker ?? '', product_id: m.product_id, product_name: prodMap.get(m.product_id) ?? '', approx: true }
        })
      }
    }

    // Merge manufacturer-linked products into suggestions
    const finalProducts = [...(prodSuggest ?? [])]
    const seenProdIds = new Set(finalProducts.map((p: any) => p.id))
    for (const p of mfrProdsRaw ?? []) {
      if (!seenProdIds.has((p as any).id)) { finalProducts.push(p as any); seenProdIds.add((p as any).id) }
    }

    res.json({ suggestions: rows, products: finalProducts })
  })

  // ── main search ─────────────────────────────────────────────────────────────
  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    const mode = String(req.query.mode ?? '')
    const rpcArgs = {
      q: q,
      p_category: String(req.query.category ?? ''),
      p_manufacturer: String(req.query.manufacturer ?? ''),
      p_filter_type: String(req.query.filterType ?? ''),
      p_availability: String(req.query.availability ?? ''),
      p_micron_max: req.query.micron ? Number(req.query.micron) : null,
    }

    // Application mode: match by product name, manufacturer, and compatible machine model
    if (mode === 'app') {
      const appMfrs = await getCachedManufacturers()
      const appMfrIds = q ? mfrIdsFor(appMfrs, q) : []
      const [{ data: products, error }, { data: mfrMatchProds }, { data: modelMatches }] = await Promise.all([
        db.rpc('search_products', rpcArgs),
        appMfrIds.length > 0
          ? db.from('products')
              .select('id,code,name,image,availability,filter_type,outer_diameter,inner_diameter,length_mm,thread,micron,rate,part_numbers(id,number,type,maker)')
              .in('manufacturer_id', appMfrIds)
              .order('name')
              .limit(20)
          : Promise.resolve({ data: [] }),
        q ? db.from('products')
            .select('id,code,name,image,availability,filter_type,outer_diameter,inner_diameter,length_mm,thread,micron,rate,part_numbers(id,number,type,maker),compatible_models!inner(model)')
            .ilike('compatible_models.model', `%${q}%`)
            .limit(50)
          : Promise.resolve({ data: [] }),
      ])
      if (error) return res.status(500).json({ error: error.message })
      const seen = new Set<number>()
      const list: any[] = []
      for (const p of (products ?? []) as any[]) { seen.add(p.id); list.push(p) }
      for (const p of (mfrMatchProds ?? []) as any[]) { if (!seen.has(p.id)) { seen.add(p.id); list.push(p) } }
      for (const p of (modelMatches ?? []) as any[]) { if (!seen.has(p.id)) { seen.add(p.id); list.push({ ...p, matched_model: q }) } }
      void Promise.resolve(db.from('search_logs').insert({ query: q, result_count: list.length, mode: 'app' })).catch(() => {})
      return res.json({ query: q, count: list.length, products: list })
    }

    // Also search with hyphen inserted (sc1 → SC-1) for codes like SC-1, SC-2
    const qWithHyphen = q ? q.replace(/^([a-zA-Z]+)(\d)/, '$1-$2') : ''

    // Code variants handle sc1 ↔ sc01 ↔ sc001 leading-zero differences
    const codeVars = q ? scCodeVariants(q) : []
    const codeOrSearch = q ? [
      ...codeVars.map(v => `code.ilike.%${v}%`),
      `code.ilike.%${qWithHyphen}%`,
    ].join(',') : ''

    // Resolve manufacturer IDs from cache (no extra DB hit after first load)
    const searchMfrs = await getCachedManufacturers()
    const searchMfrIds = q ? mfrIdsFor(searchMfrs, q) : []

    // Run RPC, direct product-code search, compatible-model search, and manufacturer search in parallel
    const [{ data: products, error }, { data: codeMatches }, { data: modelMatches }, { data: mfrMatchProds }] = await Promise.all([
      db.rpc('search_products', rpcArgs),
      q ? db.from('products')
        .select('id,code,name,image,availability,filter_type,outer_diameter,inner_diameter,length_mm,thread,micron,rate,part_numbers(id,number,type,maker)')
        .or(codeOrSearch)
        .order('code')
        .limit(20) : Promise.resolve({ data: [] }),
      q ? db.from('products')
        .select('id,code,name,image,availability,filter_type,outer_diameter,inner_diameter,length_mm,thread,micron,rate,part_numbers(id,number,type,maker),compatible_models!inner(model)')
        .ilike('compatible_models.model', `%${q}%`)
        .limit(50) : Promise.resolve({ data: [] }),
      searchMfrIds.length > 0
        ? db.from('products')
            .select('id,code,name,image,availability,filter_type,outer_diameter,inner_diameter,length_mm,thread,micron,rate,part_numbers(id,number,type,maker)')
            .in('manufacturer_id', searchMfrIds)
            .order('code')
            .limit(20)
        : Promise.resolve({ data: [] }),
    ])
    if (error) return res.status(500).json({ error: error.message })

    const mfrMatches: any[] = (mfrMatchProds ?? []) as any[]

    const modelProducts = (modelMatches ?? []) as any[]

    // Merge: code matches first, then RPC results, then model matches, then manufacturer matches (dedup by id)
    const rpcList = (products ?? []) as any[]
    const seen = new Set<number>()
    const list: any[] = []
    for (const p of (codeMatches ?? [])) { seen.add(p.id); list.push(p) }
    for (const p of rpcList) { if (!seen.has(p.id)) { seen.add(p.id); list.push(p) } }
    for (const p of (modelProducts ?? [])) { if (!seen.has(p.id)) { seen.add(p.id); list.push({ ...p, matched_model: q }) } }
    for (const p of mfrMatches) { if (!seen.has(p.id)) { seen.add(p.id); list.push(p) } }

    // Annotate matched part number
    if (q) {
      const norm = normalize(q)
      for (const p of list) {
        const hit = (p.part_numbers ?? []).find((pn: any) => normalize(pn.number).includes(norm))
        if (hit) p.matched_part = hit.number
      }
    }

    // Fuzzy fallback when nothing matched
    if (q && list.length === 0) {
      const { data: fuzzy } = await db.rpc('fuzzy_part_search', { q: normalize(q), max_results: 10 })
      if ((fuzzy as any[])?.length) {
        const fIds = (fuzzy as any[]).map((f: any) => f.product_id)
        const distMap = new Map((fuzzy as any[]).map((f: any) => [f.product_id, f.similarity]))
        const { data: fp } = await db.from('products')
          .select('id,code,name,image,availability,filter_type,outer_diameter,inner_diameter,length_mm,thread,micron,rate,part_numbers(id,number,type,maker)')
          .in('id', fIds)
        const fuzzyProds = ((fp ?? []) as any[])
        for (const p of fuzzyProds) {
          const m = (fuzzy as any[]).find((f: any) => f.product_id === p.id)
          if (m) p.matched_part = m.number
        }
        fuzzyProds.sort((a: any, b: any) => (distMap.get(b.id) ?? 0) - (distMap.get(a.id) ?? 0))
        return res.json({ query: q, count: fuzzyProds.length, products: fuzzyProds, fuzzy: true })
      }
    }

    // Fire-and-forget search log (silently ignored if table missing)
    void Promise.resolve(db.from('search_logs').insert({ query: q, result_count: list.length, mode: 'part' })).catch(() => {})
    res.json({ query: q, count: list.length, products: list })
  })

  // ── size search ─────────────────────────────────────────────────────────────
  app.get('/api/size-search', async (req, res) => {
    const tol = req.query.tol === undefined ? 5 : Math.max(0, Number(req.query.tol))
    const { data, error } = await db.rpc('size_search_products', {
      p_od: req.query.od ? Number(req.query.od) : null,
      p_id: req.query.idm ? Number(req.query.idm) : null,
      p_len: req.query.len ? Number(req.query.len) : null,
      p_tol: tol,
      p_micron: req.query.micron ? Number(req.query.micron) : null,
      p_thread: String(req.query.thread ?? ''),
      p_material: String(req.query.material ?? ''),
      p_filter_type: String(req.query.filterType ?? ''),
      p_category: String(req.query.category ?? ''),
    })
    if (error) return res.status(500).json({ error: error.message })
    const list = (data ?? []) as any[]
    res.json({ count: list.length, products: list, tolerance: tol })
  })

  // ── dimension search (per-field lower/upper offset) ─────────────────────────
  app.get('/api/dim-search', async (req, res) => {
    const n = (k: string) => req.query[k] !== undefined && req.query[k] !== '' ? Number(req.query[k]) : null

    const od  = n('od');  const od_lo  = n('od_lo')  ?? 5; const od_hi  = n('od_hi')  ?? 5
    const lod = n('lod'); const lod_lo = n('lod_lo') ?? 5; const lod_hi = n('lod_hi') ?? 5
    const idm = n('idm'); const idm_lo = n('idm_lo') ?? 5; const idm_hi = n('idm_hi') ?? 5
    const len = n('len'); const len_lo = n('len_lo') ?? 5; const len_hi = n('len_hi') ?? 5
    const bh  = n('bh');  const bh_lo  = n('bh_lo')  ?? 5; const bh_hi  = n('bh_hi')  ?? 5
    const micron   = n('micron')
    const thread   = String(req.query.thread    ?? '').trim()
    const top_cap  = String(req.query.top_cap   ?? '').trim()
    const bot_cap  = String(req.query.bot_cap   ?? '').trim()
    const category = String(req.query.category  ?? '').trim()

    // Need at least one dimension specified
    if (od == null && lod == null && idm == null && len == null && bh == null && micron == null && !thread && !top_cap && !bot_cap) {
      return res.json({ count: 0, products: [] })
    }

    let query = db.from('products')
      .select('id,code,name,image,availability,filter_type,outer_diameter,inner_diameter,largest_od,body_height,length_mm,thread,micron,top_cap,bottom_cap,rate,part_numbers(id,number,type,maker),category:categories!inner(slug)')
    if (category) { query = (query as any).eq('categories.slug', category) }
    if (od  != null) { query = (query.gte('outer_diameter', od  - od_lo)  as any).lte('outer_diameter', od  + od_hi)  }
    if (lod != null) { query = (query.gte('largest_od',     lod - lod_lo) as any).lte('largest_od',     lod + lod_hi) }
    if (idm != null) { query = (query.gte('inner_diameter', idm - idm_lo) as any).lte('inner_diameter', idm + idm_hi) }
    if (len != null) { query = (query.gte('length_mm',      len - len_lo) as any).lte('length_mm',      len + len_hi) }
    if (bh  != null) { query = (query.gte('body_height',    bh  - bh_lo)  as any).lte('body_height',    bh  + bh_hi)  }
    if (micron  != null) { query = (query as any).lte('micron', micron) }
    if (thread)   { query = (query as any).ilike('thread',     `%${thread}%`)  }
    if (top_cap)  { query = (query as any).ilike('top_cap',    `%${top_cap}%`) }
    if (bot_cap)  { query = (query as any).ilike('bottom_cap', `%${bot_cap}%`) }

    const { data, error } = await (query as any).order('code').limit(60)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ count: (data ?? []).length, products: data ?? [] })
  })

  // ── products list (admin) ───────────────────────────────────────────────────
  app.get('/api/products', async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    const category = String(req.query.category ?? '')
    const manufacturer = String(req.query.manufacturer ?? '')
    const filterType = String(req.query.filterType ?? '')
    const availability = String(req.query.availability ?? '')
    const micron = req.query.micron ? Number(req.query.micron) : null

    let data: any[] | null = null
    let error: any = null

    if (q) {
      // full-text RPC search when query present
      const result = await db.rpc('search_products', {
        q,
        p_category: category,
        p_manufacturer: manufacturer,
        p_filter_type: filterType,
        p_availability: availability,
        p_micron_max: micron,
      })
      data = result.data
      error = result.error
    } else {
      // direct query when browsing without a search term
      let query = db.from('products')
        .select('id,code,name,image,availability,filter_type,outer_diameter,inner_diameter,length_mm,thread,micron,part_numbers(id,number,type,maker)')
        .order('name')
        .limit(200)
      if (category) {
        const { data: cat } = await db.from('categories').select('id').eq('slug', category).maybeSingle()
        query = cat ? query.eq('category_id', cat.id) as any : query.eq('category_id', -1) as any
      }
      if (manufacturer) {
        const { data: mfr } = await db.from('manufacturers').select('id').ilike('name', manufacturer).maybeSingle()
        if (mfr) query = query.eq('manufacturer_id', mfr.id) as any
      }
      if (filterType) query = query.eq('filter_type', filterType) as any
      if (availability) query = query.eq('availability', availability) as any
      if (micron != null) query = query.lte('micron', micron) as any
      const result = await query
      data = result.data
      error = result.error
    }

    if (error) return res.status(500).json({ error: error.message })

    // For admin list: also fetch rate
    const ids = ((data ?? []) as any[]).map((p: any) => p.id)
    let rateMap = new Map<number, number | null>()
    if (ids.length > 0) {
      const { data: rates } = await db.from('products').select('id,rate').in('id', ids)
      for (const r of rates ?? []) rateMap.set(r.id, r.rate)
    }
    const products = ((data ?? []) as any[]).map((p: any) => ({ ...p, rate: rateMap.get(p.id) ?? null }))
    res.json({ products })
  })

  // ── single product ──────────────────────────────────────────────────────────
  app.get('/api/products/:id', async (req, res) => {
    const id = Number(req.params.id)
    const { data: p, error } = await db.from('products')
      .select('*, manufacturer:manufacturers(name), category:categories(name, slug), part_numbers(id, number, type, maker)')
      .eq('id', id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!p) return res.status(404).json({ error: 'Product not found' })

    const [{ data: specs }, { data: images }, { data: models }, { data: apps }, { data: related }] = await Promise.all([
      db.from('product_specs').select('name,value').eq('product_id', id),
      db.from('product_images').select('url').eq('product_id', id).order('sort'),
      db.from('compatible_models').select('model,manufacturer').eq('product_id', id),
      db.from('product_applications').select('name').eq('product_id', id),
      db.from('products')
        .select('*, manufacturer:manufacturers(name), category:categories(name, slug), part_numbers(id, number, type, maker)')
        .eq('category_id', p.category_id).neq('id', id).limit(4),
    ])

    const fmt = (prod: any) => ({
      ...prod,
      manufacturer: prod.manufacturer?.name ?? null,
      category: prod.category?.name ?? null,
      category_slug: prod.category?.slug ?? null,
      part_count: prod.part_numbers?.length ?? 0,
    })

    const product = {
      ...fmt(p),
      specs: specs ?? [],
      images: (p as any).images?.length ? (p as any).images : (images ?? []).map((r: any) => r.url),
      models: models ?? [],
      applications: (apps ?? []).map((r: any) => r.name),
      related: stripInternal((related ?? []).map(fmt)),
    }
    res.json(product)
  })

  // ── product CRUD (admin) ────────────────────────────────────────────────────
  app.post('/api/products', async (req, res) => {
    const b = req.body
    if (!b.name || !b.code) return res.status(400).json({ error: 'Name and code are required' })
    const mfrCache = new Map<string, number | null>()
    const catCache = new Map<string, number | null>()
    try {
      const { data, error } = await db.from('products').insert({
        name: b.name, code: b.code,
        manufacturer_id: await ensureManufacturer(b.manufacturer, mfrCache),
        category_id: await ensureCategory(b.category, catCache),
        description: b.description ?? '', image: b.image || '/img/cat-process.svg',
        model_no: b.model_no ?? '', images: b.images ?? [],
        filter_type: b.filter_type ?? '', material: b.material ?? '',
        availability: b.availability ?? 'In Stock',
        outer_diameter: b.outer_diameter ?? null, inner_diameter: b.inner_diameter ?? null,
        largest_od: b.largest_od ?? null, body_height: b.body_height ?? null,
        length_mm: b.length_mm ?? null, thread: b.thread ?? '',
        micron: b.micron ?? null, connection_type: b.connection_type ?? '',
        pressure_rating: b.pressure_rating ?? '', rate: b.rate ?? null,
        top_cap: b.top_cap ?? null, bottom_cap: b.bottom_cap ?? null,
      }).select('id').single()
      if (error) throw error
      const productId = data.id
      for (const pn of b.part_numbers ?? []) {
        if (pn.number) await db.from('part_numbers').insert({
          product_id: productId, number: pn.number, normalized: normalize(pn.number),
          type: pn.type || 'Cross Reference', maker: pn.maker || '',
        })
      }
      res.json({ id: productId })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.put('/api/products/:id', async (req, res) => {
    const b = req.body
    const mfrCache = new Map<string, number | null>()
    const catCache = new Map<string, number | null>()
    try {
      const { error } = await db.from('products').update({
        name: b.name, code: b.code,
        manufacturer_id: await ensureManufacturer(b.manufacturer, mfrCache),
        category_id: await ensureCategory(b.category, catCache),
        description: b.description ?? '', image: b.image ?? '',
        model_no: b.model_no ?? '', images: b.images ?? [],
        filter_type: b.filter_type ?? '', material: b.material ?? '',
        availability: b.availability ?? 'In Stock',
        outer_diameter: b.outer_diameter ?? null, inner_diameter: b.inner_diameter ?? null,
        largest_od: b.largest_od ?? null, body_height: b.body_height ?? null,
        length_mm: b.length_mm ?? null, thread: b.thread ?? '',
        micron: b.micron ?? null, connection_type: b.connection_type ?? '',
        pressure_rating: b.pressure_rating ?? '', rate: b.rate ?? null,
        top_cap: b.top_cap ?? null, bottom_cap: b.bottom_cap ?? null,
      }).eq('id', req.params.id)
      if (error) throw error
      res.json({ ok: true })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.delete('/api/products/:id', async (req, res) => {
    await db.from('products').delete().eq('id', req.params.id)
    res.json({ ok: true })
  })

  // ── part numbers ────────────────────────────────────────────────────────────
  app.post('/api/products/:id/part-numbers', async (req, res) => {
    const { number, type, maker } = req.body
    if (!number) return res.status(400).json({ error: 'Part number required' })
    const { data, error } = await db.from('part_numbers').insert({
      product_id: Number(req.params.id), number, normalized: normalize(number),
      type: type || 'Cross Reference', maker: maker || '',
    }).select('id').single()
    if (error) return res.status(400).json({ error: error.message })
    res.json({ id: data.id })
  })

  app.delete('/api/part-numbers/:id', async (req, res) => {
    await db.from('part_numbers').delete().eq('id', req.params.id)
    res.json({ ok: true })
  })

  // ── categories & manufacturers ─────────────────────────────────────────────
  app.post('/api/categories', async (req, res) => {
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const { data, error } = await db.from('categories')
        .insert({ name, slug, description: description ?? '', image: req.body.image || '/img/cat-process.svg' })
        .select('id').single()
      if (error) throw error
      res.json({ id: data.id })
    } catch (e: any) { res.status(400).json({ error: e.message }) }
  })

  app.post('/api/manufacturers', async (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Name required' })
    try {
      const { data, error } = await db.from('manufacturers')
        .insert({ name: req.body.name }).select('id').single()
      if (error) throw error
      res.json({ id: data.id })
    } catch (e: any) { res.status(400).json({ error: e.message }) }
  })

  // ── quotes ──────────────────────────────────────────────────────────────────
  app.post('/api/quotes', async (req, res) => {
    const b = req.body
    if (!b.name || !b.email) return res.status(400).json({ error: 'Name and email are required' })
    const { data, error } = await db.from('quote_requests').insert({
      name: b.name, company: b.company ?? '', email: b.email, phone: b.phone ?? '',
      product: b.product ?? '', part_number: b.part_number ?? '',
      quantity: String(b.quantity ?? ''), message: b.message ?? '',
    }).select('id').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ id: data.id })
  })

  app.get('/api/quotes', async (_req, res) => {
    const { data } = await db.from('quote_requests').select('*').order('id', { ascending: false })
    res.json({ quotes: data ?? [] })
  })

  app.patch('/api/quotes/:id', async (req, res) => {
    await db.from('quote_requests').update({ status: req.body.status ?? 'New' }).eq('id', req.params.id)
    res.json({ ok: true })
  })

  // ── CSV import ──────────────────────────────────────────────────────────────
  app.post('/api/import', async (req, res) => {
    const { rows, mapping } = req.body as { rows: Record<string, string>[]; mapping: Record<string, string> }
    if (!Array.isArray(rows) || !mapping?.model || !mapping?.part_number) {
      return res.status(400).json({ error: 'Rows plus "model" and "part_number" column mappings are required.' })
    }

    let productsCreated = 0, partsAdded = 0, skipped = 0
    const errors: string[] = []
    const mfrCache = new Map<string, number | null>()
    const catCache = new Map<string, number | null>()

    // Pre-batch all unique manufacturers and categories
    const uniqueMfrs = new Set(rows.map(r => (mapping.manufacturer ? r[mapping.manufacturer] ?? '' : '').trim()).filter(Boolean))
    const uniqueCats = new Set(rows.map(r => (mapping.category ? r[mapping.category] ?? '' : '').trim()).filter(Boolean))
    if (uniqueMfrs.size > 0) {
      await db.from('manufacturers').upsert([...uniqueMfrs].map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
      const { data: mfrRows } = await db.from('manufacturers').select('id,name').in('name', [...uniqueMfrs])
      for (const m of mfrRows ?? []) mfrCache.set(m.name, m.id)
    }
    if (uniqueCats.size > 0) {
      await db.from('categories').upsert([...uniqueCats].map(name => ({
        name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), image: '/img/cat-process.svg',
      })), { onConflict: 'name', ignoreDuplicates: true })
      const { data: catRows } = await db.from('categories').select('id,name').in('name', [...uniqueCats])
      for (const c of catRows ?? []) catCache.set(c.name, c.id)
    }

    try {
      const prodLookup = new Map<string, number>()
      const partRows: any[] = []

      for (const [i, row] of rows.entries()) {
        const model = (row[mapping.model] ?? '').trim()
        const partNumber = (row[mapping.part_number] ?? '').trim()
        const manufacturer = (mapping.manufacturer ? row[mapping.manufacturer] ?? '' : '').trim()
        if (!model || !partNumber) { skipped++; if (model || partNumber) errors.push(`Row ${i + 2}: missing model or part number`); continue }

        const key = `${model.toLowerCase()}|${manufacturer.toLowerCase()}`
        if (!prodLookup.has(key)) {
          const { data: existing } = await db.from('products')
            .select('id').ilike('name', model).maybeSingle()
          if (existing) {
            prodLookup.set(key, existing.id)
          } else {
            const code = `IMP-${normalize(model).toUpperCase().slice(0, 18)}-${Math.abs([...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)).toString(36).slice(0, 4).toUpperCase()}`
            const num = (f: string) => (mapping[f] && row[mapping[f]] !== undefined && row[mapping[f]] !== '' ? Number(String(row[mapping[f]]).replace(/[^\d.]/g, '')) || null : null)
            const txt = (f: string) => (mapping[f] ? (row[mapping[f]] ?? '').trim() : '')
            const { data: newProd } = await db.from('products').insert({
              name: model, code,
              manufacturer_id: mfrCache.get(manufacturer) ?? null,
              category_id: catCache.get(txt('category')) ?? null,
              description: txt('description'), image: '/img/cat-process.svg',
              filter_type: txt('filter_type'), material: txt('material'),
              outer_diameter: num('od'), inner_diameter: num('idm'),
              length_mm: num('length'), thread: txt('thread'), micron: num('micron'),
            }).select('id').maybeSingle()
            if (newProd) { prodLookup.set(key, newProd.id); productsCreated++ }
          }
        }

        const productId = prodLookup.get(key)
        if (!productId) continue
        const type = mapping.part_type ? (row[mapping.part_type] ?? '').trim() || 'Cross Reference' : 'Cross Reference'
        const maker = mapping.part_maker ? (row[mapping.part_maker] ?? '').trim() : manufacturer
        partRows.push({ product_id: productId, number: partNumber, normalized: normalize(partNumber), type, maker })
      }

      // Batch upsert part numbers
      for (let i = 0; i < partRows.length; i += 500) {
        const { error } = await db.from('part_numbers')
          .upsert(partRows.slice(i, i + 500), { onConflict: 'product_id,normalized', ignoreDuplicates: true })
        if (!error) partsAdded += Math.min(500, partRows.length - i)
      }

      res.json({ productsCreated, partsAdded, skipped, errors: errors.slice(0, 20) })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // ── gaskets ─────────────────────────────────────────────────────────────────

  /** Generate die-code variants handling leading zeros AND the space between
   *  letters and number that gasket die codes use (e.g. "si1" → "Si 01"). */
  function dieCodeVariants(q: string): string[] {
    const stripped = q.replace(/\s+/g, '')
    const m = stripped.match(/^([a-zA-Z]{1,6})(\d{1,6})$/i)
    if (!m) return [q]
    const [, prefix, digits] = m
    const num = parseInt(digits, 10)
    const s = new Set<string>()
    // Without space — no false positives (si1 won't match "Si 138")
    s.add(`${prefix}${num}`)                              // si1
    s.add(`${prefix}${String(num).padStart(2, '0')}`)    // si01
    s.add(`${prefix}${String(num).padStart(3, '0')}`)    // si001
    s.add(`${prefix}${String(num).padStart(4, '0')}`)    // si0001
    // With space + PADDED only — "si 01" matches "Si 01" but NOT "Si 138"
    // (never add "si 1" without padding — that matches "Si 138", "Si 147" etc.)
    s.add(`${prefix} ${String(num).padStart(2, '0')}`)   // si 01
    s.add(`${prefix} ${String(num).padStart(3, '0')}`)   // si 001
    s.add(`${prefix}-${String(num).padStart(2, '0')}`)   // si-01
    s.add(q)
    return [...s]
  }

  app.get('/api/gaskets', async (req, res) => {
    const q = String(req.query.q ?? '').trim()

    // Supplement the RPC with a direct query that handles space+zero variants
    // e.g. "si1" → also tries "si 01", "si01", "si 1" etc.
    const dieVars = q ? dieCodeVariants(q) : []
    const [{ data: rows, error }, { data: directDie }] = await Promise.all([
      db.rpc('search_gaskets', { q }),
      dieVars.length > 1
        ? db.from('gaskets').select('*')
            .or(dieVars.map(v => `die_no.ilike.%${v}%`).join(','))
            .order('model').order('sr_no').limit(50)
        : Promise.resolve({ data: [] }),
    ])
    if (error) return res.status(500).json({ error: error.message })

    // Merge: RPC first, then direct die matches (dedup by id)
    const seen = new Set<number>()
    const merged: any[] = []
    for (const r of (rows ?? []) as any[]) { seen.add(r.id); merged.push(r) }
    for (const r of (directDie ?? []) as any[]) { if (!seen.has(r.id)) { seen.add(r.id); merged.push(r) } }

    let gaskets = merged
    let fuzzy = false

    // Fuzzy fallback via JS editDistance when RPC returns nothing
    if (q && gaskets.length === 0) {
      const norm = normalize(q)
      const max = fuzzyMax(norm.length)
      if (max > 0) {
        const { data: all } = await db.from('gaskets').select('*').order('model').order('sr_no')
        gaskets = (all ?? [])
          .map((g: any) => ({
            g,
            dist: Math.min(
              editDistance(norm, normalize(g.part_no), max),
              g.die_no ? editDistance(norm, normalize(g.die_no), max) : max + 1,
              g.ccn ? editDistance(norm, normalize(g.ccn), max) : max + 1,
            ),
          }))
          .filter((x) => x.dist <= max)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 20)
          .map((x) => x.g)
        fuzzy = gaskets.length > 0
      }
    }

    const byModel = new Map<string, any[]>()
    for (const r of gaskets) {
      if (!byModel.has(r.model)) byModel.set(r.model, [])
      byModel.get(r.model)!.push(r)
    }
    res.json({ count: gaskets.length, fuzzy, models: [...byModel.entries()].map(([model, items]) => ({ model, items })) })
  })

  app.post('/api/gaskets', async (req, res) => {
    const b = req.body
    if (!b.model || !b.part_no) return res.status(400).json({ error: 'Model and part number are required' })
    const { data, error } = await db.from('gaskets').insert({
      model: b.model, sr_no: b.sr_no ?? null, part_no: b.part_no, die_no: b.die_no ?? '',
      description: b.description ?? '', ccn: b.ccn ?? '', nos: b.nos ?? 1,
      rate: b.rate ?? null, rate_15: b.rate_15 ?? null, image: b.image || '/img/cat-gasket.svg',
    }).select('id').single()
    if (error) return res.status(400).json({ error: error.message })
    res.json({ id: data.id })
  })

  app.put('/api/gaskets/:id', async (req, res) => {
    const b = req.body
    const { error } = await db.from('gaskets').update({
      model: b.model, sr_no: b.sr_no ?? null, part_no: b.part_no, die_no: b.die_no ?? '',
      description: b.description ?? '', ccn: b.ccn ?? '', nos: b.nos ?? 1,
      rate: b.rate ?? null, rate_15: b.rate_15 ?? null, image: b.image ?? '',
    }).eq('id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  })

  app.delete('/api/gaskets/:id', async (req, res) => {
    await db.from('gaskets').delete().eq('id', req.params.id)
    res.json({ ok: true })
  })

  // Gasket CSV import
  app.post('/api/gaskets/import', async (req, res) => {
    const { rows, mapping } = req.body as { rows: Record<string, string>[]; mapping: Record<string, string> }
    if (!Array.isArray(rows) || !mapping?.model || !mapping?.part_no) {
      return res.status(400).json({ error: 'Rows plus "model" and "part_no" column mappings are required.' })
    }
    const num = (row: Record<string, string>, f: string) =>
      mapping[f] && row[mapping[f]] !== undefined && row[mapping[f]] !== ''
        ? Number(String(row[mapping[f]]).replace(/[^\d.]/g, '')) || null : null
    const txt = (row: Record<string, string>, f: string) => (mapping[f] ? (row[mapping[f]] ?? '').trim() : '')

    let added = 0, skipped = 0
    try {
      const toInsert = []
      for (const row of rows) {
        const model = txt(row, 'model'), partNo = txt(row, 'part_no')
        if (!model || !partNo) { skipped++; continue }
        toInsert.push({
          model, sr_no: num(row, 'sr_no'), part_no: partNo, die_no: txt(row, 'die_no'),
          description: txt(row, 'description'), ccn: txt(row, 'ccn'), nos: num(row, 'nos') ?? 1,
          rate: num(row, 'rate'), rate_15: num(row, 'rate_15'), image: '/img/cat-gasket.svg',
        })
      }
      for (let i = 0; i < toInsert.length; i += 500) {
        const { error } = await db.from('gaskets')
          .upsert(toInsert.slice(i, i + 500), { ignoreDuplicates: true })
        if (!error) added += Math.min(500, toInsert.length - i)
      }
      res.json({ added, skipped })
    } catch (e: any) { res.status(400).json({ error: e.message }) }
  })

  // ── XLSX imports ────────────────────────────────────────────────────────────
  // SC Excel import — reads the "Products" sheet (or first sheet) using the
  // standard column format: Code, Name, Category, Manufacturer, Description,
  // Filter Type, Material, OD (mm), ID (mm), Length (mm), Thread, Micron,
  // Availability, Part Numbers (comma-separated).
  // Only existing DB columns are written — no new columns are added.
  app.post('/api/import/xlsx', requireAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
      const sheetName = wb.SheetNames.find(n => /products/i.test(n)) ?? wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      const mfrCache = new Map<string, number | null>()
      const catCache = new Map<string, number | null>()
      let synced = 0, skipped = 0
      const partRows: any[] = []

      const uniqueMfrs = [...new Set(rows.map((r: any) => String(r['Manufacturer'] ?? '')).filter(Boolean))]
      const uniqueCats = [...new Set(rows.map((r: any) => String(r['Category'] ?? '')).filter(Boolean))]
      if (uniqueMfrs.length) {
        await db.from('manufacturers').upsert(uniqueMfrs.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
        const { data } = await db.from('manufacturers').select('id,name').in('name', uniqueMfrs)
        for (const m of data ?? []) mfrCache.set(m.name, m.id)
      }
      if (uniqueCats.length) {
        await db.from('categories').upsert(uniqueCats.map(name => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), image: '/img/cat-process.svg' })), { onConflict: 'name', ignoreDuplicates: true })
        const { data } = await db.from('categories').select('id,name').in('name', uniqueCats)
        for (const c of data ?? []) catCache.set(c.name, c.id)
      }

      for (const row of rows) {
        const code = String(row['Code'] ?? '').trim()
        const name = String(row['Name'] ?? '').trim()
        if (!code || !name) { skipped++; continue }

        const num = (k: string) => { const v = String(row[k] ?? ''); return v ? parseFloat(v.replace(/[^\d.]/g, '')) || null : null }
        const productData: any = {
          code, name,
          description: String(row['Description'] ?? ''),
          filter_type: String(row['Filter Type'] ?? ''),
          material: String(row['Material'] ?? ''),
          outer_diameter: num('OD (mm)'),
          inner_diameter: num('ID (mm)'),
          length_mm: num('Length (mm)'),
          thread: String(row['Thread'] ?? ''),
          micron: num('Micron'),
          connection_type: String(row['Connection Type'] ?? ''),
          pressure_rating: String(row['Pressure Rating'] ?? ''),
          availability: String(row['Availability'] ?? '') || 'In Stock',
          manufacturer_id: mfrCache.get(String(row['Manufacturer'] ?? '')) ?? null,
          category_id: catCache.get(String(row['Category'] ?? '')) ?? null,
          image: '/img/cat-process.svg',
        }

        const { data: prod, error } = await db.from('products').upsert(productData, { onConflict: 'code' }).select('id').single()
        if (error || !prod) { skipped++; continue }
        synced++

        const pnStr = String(row['Part Numbers'] ?? '').trim()
        if (pnStr) {
          for (const pn of pnStr.split(',').map((s: string) => s.trim()).filter(Boolean)) {
            partRows.push({ product_id: prod.id, number: pn, normalized: normalize(pn), type: 'Cross Reference', maker: String(row['Manufacturer'] ?? '') })
          }
        }
      }

      for (let i = 0; i < partRows.length; i += 500) {
        await db.from('part_numbers').upsert(partRows.slice(i, i + 500), { onConflict: 'product_id,normalized', ignoreDuplicates: true })
      }

      res.json({ added: synced, updated: 0, skipped, partNumbers: partRows.length })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.post('/api/import/xlsx-gaskets', requireAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      let currentModel = ''
      let added = 0, skipped = 0
      const headerRe = /^(Sr\s*no|Part\s*no|Die\s*no|Disc?r?iption)/i
      const modelCandidates = ['231', '242', '234', '253', '15T', '2340', 'Jyoti', 'Star']
      const toInsert: any[] = []

      for (const row of raw) {
        const cells = row.slice(0, 10).map((c: any) => String(c ?? '').trim())
        const line = cells.join(' ').trim()
        if (!line) continue
        if (modelCandidates.some((m) => cells[0].startsWith(m) || cells[1]?.startsWith(m))) {
          currentModel = (cells[0] || cells[1]).replace(/\s+/g, ' '); continue
        }
        if (headerRe.test(cells[1]) || headerRe.test(cells[0])) continue
        if (!currentModel) continue
        const partNo = cells[1]
        if (!partNo) { skipped++; continue }
        toInsert.push({
          model: currentModel, sr_no: cells[0] ? Number(cells[0]) || null : null,
          part_no: partNo, die_no: cells[2], description: cells[3],
          ccn: /^\d{8,9}$/.test(cells[4]) ? cells[4] : '',
          nos: Number(cells[5]) || 1,
          rate: cells[6] ? Number(String(cells[6]).replace(/[^\d.]/g, '')) || null : null,
          rate_15: cells[7] ? Number(String(cells[7]).replace(/[^\d.]/g, '')) || null : null,
          image: '/img/cat-gasket.svg',
        })
      }

      for (let i = 0; i < toInsert.length; i += 500) {
        const { error } = await db.from('gaskets')
          .upsert(toInsert.slice(i, i + 500), { ignoreDuplicates: true })
        if (!error) added += Math.min(500, toInsert.length - i)
      }

      res.json({ added, skipped })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // ── Google Sheets bulk import (admin) ──────────────────────────────────────
  app.post('/api/import/gsheet', requireAdmin, async (req, res) => {
    const { url } = req.body as { url?: string }
    if (!url) return res.status(400).json({ error: 'url required' })

    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    if (!m) return res.status(400).json({ error: 'Invalid Google Sheets URL — copy the URL from your browser while the sheet is open.' })
    const sheetId = m[1]

    // Fetch a tab as CSV. Returns null if tab not found or sheet not public.
    const fetchTab = async (tabName: string): Promise<string | null> => {
      try {
        const r = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`)
        if (!r.ok) return null
        const text = await r.text()
        // Google returns an error page (not CSV) when the tab doesn't exist
        if (text.startsWith('<!') || text.startsWith('google.')) return null
        return text
      } catch { return null }
    }

    // Minimal CSV parser for Google Sheets export (handles quoted fields)
    const parseGoogleCSV = (text: string): Record<string, string>[] => {
      const rows: string[][] = []
      let row: string[] = [], field = '', inQ = false
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (inQ) {
          if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
          else field += ch
        } else if (ch === '"') { inQ = true }
        else if (ch === ',') { row.push(field); field = '' }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i + 1] === '\n') i++
          row.push(field); field = ''
          if (row.some(c => c !== '')) rows.push(row)
          row = []
        } else field += ch
      }
      row.push(field)
      if (row.some(c => c !== '')) rows.push(row)
      if (rows.length < 2) return []
      const headers = rows[0].map(h => h.trim())
      return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])))
        .filter(r => Object.values(r).some(v => v))
    }

    const result: Record<string, any> = {}

    // 1. Categories
    const catCSV = await fetchTab('Categories')
    if (catCSV) {
      const rows = parseGoogleCSV(catCSV)
      let done = 0
      const toUpsert = rows
        .filter(r => r['Name'])
        .map(r => ({ name: r['Name'], slug: r['Name'].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), description: r['Description'] ?? '', image: '/img/cat-process.svg' }))
      if (toUpsert.length) {
        const { error } = await db.from('categories').upsert(toUpsert, { onConflict: 'name' })
        if (!error) done = toUpsert.length
      }
      result.categories = { synced: done }
    }

    // 2. Products
    const prodCSV = await fetchTab('Products')
    if (prodCSV) {
      const rows = parseGoogleCSV(prodCSV)
      const mfrCache = new Map<string, number | null>()
      const catCache = new Map<string, number | null>()
      let synced = 0, skipped = 0

      // Pre-fetch manufacturers + categories
      const uniqueMfrs = [...new Set(rows.map(r => r['Manufacturer']).filter(Boolean))]
      const uniqueCats = [...new Set(rows.map(r => r['Category']).filter(Boolean))]
      if (uniqueMfrs.length) {
        await db.from('manufacturers').upsert(uniqueMfrs.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
        const { data } = await db.from('manufacturers').select('id,name').in('name', uniqueMfrs)
        for (const m of data ?? []) mfrCache.set(m.name, m.id)
      }
      if (uniqueCats.length) {
        await db.from('categories').upsert(uniqueCats.map(name => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), image: '/img/cat-process.svg' })), { onConflict: 'name', ignoreDuplicates: true })
        const { data } = await db.from('categories').select('id,name').in('name', uniqueCats)
        for (const c of data ?? []) catCache.set(c.name, c.id)
      }

      const partRows: any[] = []
      for (const row of rows) {
        const code = row['Code']?.trim()
        const name = row['Name']?.trim()
        if (!code || !name) { skipped++; continue }

        const num = (k: string) => row[k] ? parseFloat(String(row[k]).replace(/[^\d.]/g, '')) || null : null
        const productData: any = {
          code, name,
          description: row['Description'] ?? '',
          filter_type: row['Filter Type'] ?? '',
          material: row['Material'] ?? '',
          outer_diameter: num('OD (mm)'),
          inner_diameter: num('ID (mm)'),
          length_mm: num('Length (mm)'),
          thread: row['Thread'] ?? '',
          micron: num('Micron'),
          connection_type: row['Connection Type'] ?? '',
          pressure_rating: row['Pressure Rating'] ?? '',
          availability: row['Availability'] || 'In Stock',
          manufacturer_id: mfrCache.get(row['Manufacturer'] ?? '') ?? null,
          category_id: catCache.get(row['Category'] ?? '') ?? null,
          image: '/img/cat-process.svg',
        }

        const { data: prod, error } = await db.from('products').upsert(productData, { onConflict: 'code' }).select('id').single()
        if (error || !prod) { skipped++; continue }
        synced++

        const pnStr = row['Part Numbers']?.trim()
        if (pnStr) {
          for (const pn of pnStr.split(',').map((s: string) => s.trim()).filter(Boolean)) {
            partRows.push({ product_id: prod.id, number: pn, normalized: normalize(pn), type: 'Cross Reference', maker: row['Manufacturer'] ?? '' })
          }
        }
      }

      for (let i = 0; i < partRows.length; i += 500) {
        await db.from('part_numbers').upsert(partRows.slice(i, i + 500), { onConflict: 'product_id,normalized', ignoreDuplicates: true })
      }
      result.products = { synced, skipped, partNumbers: partRows.length }
    }

    // 3. Gaskets
    const gasketCSV = await fetchTab('Gaskets')
    if (gasketCSV) {
      const rows = parseGoogleCSV(gasketCSV)
      const toInsert = rows
        .filter(r => r['Model'] && r['Part No'])
        .map(r => ({
          model: r['Model'],
          part_no: r['Part No'],
          die_no: r['Die No'] ?? '',
          description: r['Description'] ?? '',
          ccn: r['CCN'] ?? '',
          rate: r['Rate'] ? parseFloat(r['Rate']) || null : null,
          nos: 1,
          image: '/img/cat-gasket.svg',
        }))
      let added = 0
      for (let i = 0; i < toInsert.length; i += 500) {
        const { error } = await db.from('gaskets').upsert(toInsert.slice(i, i + 500), { ignoreDuplicates: true })
        if (!error) added += Math.min(500, toInsert.length - i)
      }
      result.gaskets = { synced: added, skipped: toInsert.length - added }
    }

    if (!catCSV && !prodCSV && !gasketCSV) {
      return res.status(400).json({ error: 'Could not read any tabs. Make sure the sheet is set to "Anyone with the link can view" and has tabs named Products, Gaskets, or Categories.' })
    }

    res.json({ ok: true, ...result })
  })

  // ── stock availability (admin) ──────────────────────────────────────────────
  app.get('/api/admin/availability', requireAdmin, async (_req, res) => {
    const { data } = await db.from('products').select('code,name,availability').order('code')
    const csv = ['Code,Name,Availability',
      ...(data ?? []).map((p: any) =>
        `"${p.code}","${String(p.name ?? '').replace(/"/g, '""')}","${p.availability}"`)
    ].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="stock-template.csv"')
    res.send(csv)
  })

  app.post('/api/admin/availability', requireAdmin, async (req, res) => {
    const updates: { code: string; availability: string }[] = req.body.updates ?? []
    const VALID = new Set(['In Stock', 'Out of Stock', 'On Request'])
    let updated = 0
    for (const u of updates) {
      if (!u.code || !VALID.has(u.availability)) continue
      const { error } = await db.from('products').update({ availability: u.availability }).eq('code', u.code.trim())
      if (!error) updated++
    }
    res.json({ updated })
  })

  // ── analytics (admin) ───────────────────────────────────────────────────────
  app.get('/api/admin/analytics', requireAdmin, async (_req, res) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

      const [{ data: logs }, { count: todayCount }, { count: totalCount }] = await Promise.all([
        db.from('search_logs').select('query,result_count').gte('created_at', thirtyDaysAgo).neq('query', '').limit(1000),
        db.from('search_logs').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        db.from('search_logs').select('*', { count: 'exact', head: true }),
      ])

      const counts = new Map<string, { count: number; zeros: number }>()
      for (const row of logs ?? []) {
        const q = (row.query ?? '').toLowerCase().trim()
        if (!q) continue
        const prev = counts.get(q) ?? { count: 0, zeros: 0 }
        counts.set(q, { count: prev.count + 1, zeros: prev.zeros + (row.result_count === 0 ? 1 : 0) })
      }
      const sorted = [...counts.entries()]
        .map(([query, { count, zeros }]) => ({ query, count, zeros }))
        .sort((a, b) => b.count - a.count)

      res.json({
        topQueries: sorted.slice(0, 20),
        zeroResults: sorted.filter((q) => q.zeros > 0).sort((a, b) => b.zeros - a.zeros).slice(0, 10),
        todaySearches: todayCount ?? 0,
        totalSearches: totalCount ?? 0,
      })
    } catch {
      res.json({ topQueries: [], zeroResults: [], todaySearches: 0, totalSearches: 0, tableReady: false })
    }
  })

  // ── sync status & trigger ───────────────────────────────────────────────────
  // V1 Google Sheets sync is permanently disabled after the FilterCore V2.1 migration.
  // These endpoints return 410 Gone to prevent accidental re-activation.
  app.get('/api/sync/status', (_req, res) => {
    res.status(410).json({ error: 'Legacy V1 sync disabled. FilterCore V2.1 catalogue is now managed through the validated Excel import pipeline.' })
  })

  app.post('/api/sync/now', requireAdmin, async (_req, res) => {
    res.status(410).json({ error: 'Legacy V1 sync disabled. FilterCore V2.1 catalogue is now managed through the validated Excel import pipeline.' })
  })

  // ── export (admin) ──────────────────────────────────────────────────────────

  async function buildProductsSheet() {
    const { data } = await db
      .from('products')
      .select('code,name,description,filter_type,material,outer_diameter,inner_diameter,length_mm,thread,micron,connection_type,pressure_rating,availability,part_numbers(number,type,maker),categories(name),manufacturers(name)')
      .order('code')
    const rows = (data ?? []).map((p: any) => ({
      Code: p.code ?? '',
      Name: p.name ?? '',
      Category: p.categories?.name ?? '',
      Manufacturer: p.manufacturers?.name ?? '',
      Description: p.description ?? '',
      'Filter Type': p.filter_type ?? '',
      Material: p.material ?? '',
      'OD (mm)': p.outer_diameter ?? '',
      'ID (mm)': p.inner_diameter ?? '',
      'Length (mm)': p.length_mm ?? '',
      Thread: p.thread ?? '',
      Micron: p.micron ?? '',
      'Connection Type': p.connection_type ?? '',
      'Pressure Rating': p.pressure_rating ?? '',
      Availability: p.availability ?? 'In Stock',
      'Part Numbers': (p.part_numbers ?? []).map((n: any) => n.number).join(', '),
    }))
    return XLSX.utils.json_to_sheet(rows)
  }

  async function buildGasketsSheet() {
    const { data } = await db
      .from('gaskets')
      .select('model,part_no,die_no,description,ccn,rate')
      .order('model').order('part_no')
    const rows = (data ?? []).map((g: any) => ({
      Model: g.model ?? '',
      'Part No': g.part_no ?? '',
      'Die No': g.die_no ?? '',
      Description: g.description ?? '',
      CCN: g.ccn ?? '',
      Rate: g.rate ?? '',
    }))
    return XLSX.utils.json_to_sheet(rows)
  }

  async function buildCategoriesSheet() {
    const { data } = await db.from('categories').select('name,description').order('name')
    const rows = (data ?? []).map((c: any) => ({ Name: c.name ?? '', Description: c.description ?? '' }))
    return XLSX.utils.json_to_sheet(rows)
  }

  function sendXlsx(res: any, wb: XLSX.WorkBook, filename: string) {
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buf)
  }

  app.get('/api/export/products', requireAdmin, async (_req, res) => {
    const ws = await buildProductsSheet()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    sendXlsx(res, wb, 'filtercore-products.xlsx')
  })

  app.get('/api/export/gaskets', requireAdmin, async (_req, res) => {
    const ws = await buildGasketsSheet()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gaskets')
    sendXlsx(res, wb, 'filtercore-gaskets.xlsx')
  })

  app.get('/api/export/categories', requireAdmin, async (_req, res) => {
    const ws = await buildCategoriesSheet()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Categories')
    sendXlsx(res, wb, 'filtercore-categories.xlsx')
  })

  app.get('/api/export/all', requireAdmin, async (_req, res) => {
    const [wsP, wsG, wsC] = await Promise.all([buildProductsSheet(), buildGasketsSheet(), buildCategoriesSheet()])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsP, 'Products')
    XLSX.utils.book_append_sheet(wb, wsG, 'Gaskets')
    XLSX.utils.book_append_sheet(wb, wsC, 'Categories')
    sendXlsx(res, wb, 'filtercore-catalog.xlsx')
  })

  // ── stats ────────────────────────────────────────────────────────────────────
  app.get('/api/stats', async (_req, res) => {
    const { data, error } = await db.rpc('get_stats')
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  // V1 filter sync is disabled — startFileWatchers() now only polls gaskets
  if (!process.env.VERCEL) {
    startFileWatchers()
  }

  return app
}
