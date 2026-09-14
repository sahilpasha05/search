import path from 'node:path'
import { google } from 'googleapis'
import { db, normalize } from './db.js'

// ── Google Sheets config ──────────────────────────────────────────────────────
const FILTER_SHEET_ID = '1iJ0hYQoVuoJO_4wDTV6rUbeA9pOY840zAJsFV8G_-d8'
const FILTER_GID = '2095995'

const GASKET_SHEET_ID = '15z8qQR5YPojcKmaFBCAQQ5Avb4TyXBMDqY1PW4YZ4NI'
const GASKET_GID = '26001866'

const POLL_INTERVAL_MS = 60 * 1000

// ── V1 sync kill-switch ───────────────────────────────────────────────────────
// Set to true permanently after the FilterCore V2.1 migration (2026-09-07).
// The SC catalogue is now authoritative in Supabase; re-enabling this would
// overwrite V2.1 data with the stale V1 Google Sheets data.
const LEGACY_V1_FILTER_SYNC_DISABLED = true

// ── Sync state ────────────────────────────────────────────────────────────────
export const syncState = {
  filters: { lastSync: null as Date | null, lastModified: null as string | null, status: 'idle' as string, added: 0, updated: 0, skipped: 0 },
  gaskets: { lastSync: null as Date | null, lastModified: null as string | null, status: 'idle' as string, added: 0, skipped: 0 },
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function getAuth() {
  const credsPath = path.join(new URL('.', import.meta.url).pathname, 'gcp-credentials.json')
  return new google.auth.GoogleAuth({
    keyFile: credsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
  })
}

async function getSheetLastModified(driveId: string): Promise<string | null> {
  try {
    const drive = google.drive({ version: 'v3', auth: getAuth() })
    const r = await drive.files.get({ fileId: driveId, fields: 'modifiedTime' })
    return r.data.modifiedTime ?? null
  } catch {
    return null
  }
}

async function fetchSheetRows(spreadsheetId: string, gid: string): Promise<any[][]> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
  const sheetName = meta.data.sheets?.find((s: any) => String(s.properties?.sheetId) === gid)?.properties?.title ?? 'Sheet1'
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName })
  return (resp.data.values ?? []) as any[][]
}

// ── Filter sync ───────────────────────────────────────────────────────────────
export async function syncFilters(): Promise<{ added: number; updated: number; skipped: number; error?: string }> {
  if (LEGACY_V1_FILTER_SYNC_DISABLED) {
    const msg = 'Legacy V1 Google Sheets sync is disabled. FilterCore V2.1 catalogue is now managed through the validated Excel import pipeline.'
    syncState.filters.status = 'disabled'
    console.error('[sync] syncFilters() blocked — LEGACY_V1_FILTER_SYNC_DISABLED=true')
    return { added: 0, updated: 0, skipped: 0, error: msg }
  }
  try {
    const raw = await fetchSheetRows(FILTER_SHEET_ID, FILTER_GID)
    const lastMod = await getSheetLastModified(FILTER_SHEET_ID)

    const scRe = /^Sc\s*(\d+)/i
    type Entry = {
      sc: string; maker: string; name: string; od?: number; id?: number; h?: number
      stock: boolean; ox?: string; nki?: string; parts: Array<{ number: string; maker: string; type: string }>
    }
    const parsed: Entry[] = []
    let cur: Entry | null = null

    for (const row of raw) {
      const col0 = String(row[0] ?? '').trim()
      const col1 = String(row[1] ?? '').trim()
      const col2 = String(row[2] ?? '').trim()
      const col3 = String(row[3] ?? '').trim()
      if (scRe.test(col0)) {
        if (cur) parsed.push(cur)
        const od = row[5] ? Number(row[5]) : undefined
        const id_ = row[6] ? Number(row[6]) : undefined
        const h = row[7] ? Number(row[7]) : undefined
        const ox = String(row[8] ?? '').trim() || undefined
        const nki = String(row[9] ?? '').trim() || undefined
        cur = { sc: col0, maker: col1, name: col2, od: isNaN(od!) ? undefined : od, id: isNaN(id_!) ? undefined : id_, h: isNaN(h!) ? undefined : h, stock: col3 === '*', ox, nki, parts: [] }
        if (col2) cur.parts.push({ number: col2, maker: col1, type: col1 ? 'OEM' : 'Cross Reference' })
      } else if (cur && col2) {
        const fuse = col1.match(/^([A-Za-z][a-z]+(?:[A-Z][a-z]*)*)([A-Z0-9][\w\-./]*)$/)
        if (fuse && !col2) cur.parts.push({ number: fuse[2], maker: fuse[1], type: 'Cross Reference' })
        else cur.parts.push({ number: col2, maker: col1, type: 'Cross Reference' })
      }
    }
    if (cur) parsed.push(cur)

    // 1. Upsert manufacturers
    const uniqueMakers = [...new Set(parsed.map(p => p.maker).filter(Boolean))]
    if (uniqueMakers.length > 0) {
      await db.from('manufacturers').upsert(uniqueMakers.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
    }
    const { data: mfrRows } = await db.from('manufacturers').select('id,name')
    const mfrMap = Object.fromEntries((mfrRows ?? []).map((r: any) => [r.name, r.id]))

    // 2. Get default category
    const { data: defCat } = await db.from('categories').select('id').eq('slug', 'industrial-process').maybeSingle()
    const defaultCatId = defCat?.id ?? null

    // 3. Upsert products
    const validParsed = parsed.filter(p => p.name)
    const productRows = validParsed.map(p => {
      const code = p.sc.replace(/\.\s*$/, '').replace(/\s+/g, '-').toUpperCase()
      return {
        name: p.name, code,
        manufacturer_id: p.maker ? mfrMap[p.maker] ?? null : null,
        category_id: defaultCatId,
        description: `${p.name}. SC code ${code} — cross-reference verified.`,
        image: '/img/cat-compressor.svg',
        outer_diameter: p.od ?? null, inner_diameter: p.id ?? null, length_mm: p.h ?? null,
        availability: p.stock ? 'In Stock' : 'On Request',
      }
    })

    let added = 0, updated = 0

    // Fetch existing codes to separate new from existing
    const codes = productRows.map(p => p.code)
    const { data: existing } = await db.from('products').select('code').in('code', codes)
    const existingCodes = new Set((existing ?? []).map((r: any) => r.code))
    added = productRows.filter(p => !existingCodes.has(p.code)).length
    updated = productRows.filter(p => existingCodes.has(p.code)).length

    for (let i = 0; i < productRows.length; i += 300) {
      await db.from('products').upsert(productRows.slice(i, i + 300), { onConflict: 'code' })
    }

    // 4. Fetch product IDs
    const { data: prodRows } = await db.from('products').select('id,code').in('code', codes)
    const prodMap = Object.fromEntries((prodRows ?? []).map((r: any) => [r.code, r.id]))

    // 5. Collect and batch-upsert part numbers
    const pnRows: any[] = []
    for (const p of validParsed) {
      const code = p.sc.replace(/\.\s*$/, '').replace(/\s+/g, '-').toUpperCase()
      const productId = prodMap[code]
      if (!productId) continue
      for (const pn of p.parts) {
        if (pn.number) pnRows.push({ product_id: productId, number: pn.number, normalized: normalize(pn.number), type: pn.type, maker: pn.maker })
      }
      if (p.ox) pnRows.push({ product_id: productId, number: p.ox, normalized: normalize(p.ox), type: 'Alternative', maker: 'OX' })
      if (p.nki) pnRows.push({ product_id: productId, number: p.nki, normalized: normalize(p.nki), type: 'Alternative', maker: 'NKI' })
    }

    for (let i = 0; i < pnRows.length; i += 500) {
      await db.from('part_numbers').upsert(pnRows.slice(i, i + 500), { onConflict: 'product_id,normalized', ignoreDuplicates: true })
    }

    const skipped = parsed.length - validParsed.length
    syncState.filters = { lastSync: new Date(), lastModified: lastMod, status: 'ok', added, updated, skipped }
    console.log(`[sync] Filters: +${added} added, ~${updated} updated, ${skipped} skipped`)
    return { added, updated, skipped }
  } catch (e: any) {
    syncState.filters.status = `error: ${e.message}`
    console.error('[sync] Filters error:', e.message)
    return { added: 0, updated: 0, skipped: 0, error: e.message }
  }
}

// ── Gasket sync ───────────────────────────────────────────────────────────────
export async function syncGaskets(): Promise<{ added: number; skipped: number; error?: string }> {
  try {
    const raw = await fetchSheetRows(GASKET_SHEET_ID, GASKET_GID)
    const lastMod = await getSheetLastModified(GASKET_SHEET_ID)

    let currentModel = ''
    let skipped = 0
    const headerRe = /^(Sr\s*no|Part\s*no|Die\s*no|Disc?r?iption)/i
    const modelCandidates = ['231', '242', '234', '253', '15T', '2340', 'Jyoti', 'Star']
    const toInsert: any[] = []

    for (const row of raw) {
      const cells = (row as any[]).slice(0, 10).map((c) => String(c ?? '').trim())
      const line = cells.join(' ').trim()
      if (!line) continue
      if (modelCandidates.some((m) => cells[0].startsWith(m) || (cells[1] ?? '').startsWith(m))) {
        currentModel = (cells[0] || cells[1]).replace(/\s+/g, ' ')
        continue
      }
      if (headerRe.test(cells[1]) || headerRe.test(cells[0])) continue
      if (!currentModel) continue
      const partNo = cells[1]
      if (!partNo) { skipped++; continue }

      // Check duplicate within this batch
      const normPart = partNo.toLowerCase().replace(/ /g, '')
      const dup = toInsert.find(g => g.model === currentModel && g.part_no.toLowerCase().replace(/ /g, '') === normPart)
      if (dup) { skipped++; continue }

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

    let added = 0
    for (let i = 0; i < toInsert.length; i += 500) {
      const { error } = await db.from('gaskets')
        .upsert(toInsert.slice(i, i + 500), { ignoreDuplicates: true })
      if (!error) added += Math.min(500, toInsert.length - i)
    }

    syncState.gaskets = { lastSync: new Date(), lastModified: lastMod, status: 'ok', added, skipped }
    console.log(`[sync] Gaskets: +${added} added, ${skipped} skipped/existing`)
    return { added, skipped }
  } catch (e: any) {
    syncState.gaskets.status = `error: ${e.message}`
    console.error('[sync] Gaskets error:', e.message)
    return { added: 0, skipped: 0, error: e.message }
  }
}

// ── Poller ────────────────────────────────────────────────────────────────────
let filterLastMod: string | null = null
let gasketLastMod: string | null = null

async function pollAndSync() {
  try {
    const drive = google.drive({ version: 'v3', auth: getAuth() })
    const [fRes, gRes] = await Promise.all([
      drive.files.get({ fileId: FILTER_SHEET_ID, fields: 'modifiedTime' }),
      drive.files.get({ fileId: GASKET_SHEET_ID, fields: 'modifiedTime' }),
    ])
    const fMod = fRes.data.modifiedTime ?? null
    const gMod = gRes.data.modifiedTime ?? null
    if (fMod && fMod !== filterLastMod) { filterLastMod = fMod; syncFilters() }
    if (gMod && gMod !== gasketLastMod) { gasketLastMod = gMod; syncGaskets() }
  } catch (e: any) {
    console.error('[sync] Poll error:', e.message)
  }
}

export function startFileWatchers() {
  // V1 filter sync is permanently disabled — only gasket polling remains active
  console.error('[sync] startFileWatchers() — V1 filter sync is DISABLED. Gasket poller only.')
  syncGaskets()
  setInterval(() => {
    // Only poll gaskets; syncFilters() is guarded by LEGACY_V1_FILTER_SYNC_DISABLED
    getSheetLastModified(GASKET_SHEET_ID).then(gMod => {
      if (gMod && gMod !== gasketLastMod) { gasketLastMod = gMod; syncGaskets() }
    }).catch((e: any) => { console.error('[sync] Gasket poll error:', e.message) })
  }, POLL_INTERVAL_MS)
  console.log(`[sync] Gasket-only poller started (every ${POLL_INTERVAL_MS / 1000}s)`)
}

export const FILTER_XLSX = `https://docs.google.com/spreadsheets/d/${FILTER_SHEET_ID}`
export const GASKET_XLSX = `https://docs.google.com/spreadsheets/d/${GASKET_SHEET_ID}`
