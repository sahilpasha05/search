import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hxqnciziixrxzpkyolbj.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const sqlite = new Database(path.join(__dirname, 'filtercore.db'))

async function chunk(arr, size, fn) {
  for (let i = 0; i < arr.length; i += size) {
    await fn(arr.slice(i, i + size), i)
  }
}

async function main() {
  console.log('=== FilterCore → Supabase migration ===\n')

  // ── 1. Categories ──────────────────────────────────────────────────────────
  console.log('1. Categories…')
  const cats = sqlite.prepare('SELECT * FROM categories').all()
  const { error: ce } = await supa.from('categories').upsert(
    cats.map(c => ({ name: c.name, slug: c.slug, description: c.description ?? '', image: c.image ?? '' })),
    { onConflict: 'slug' }
  )
  if (ce) { console.error('  categories error:', ce.message); process.exit(1) }

  const { data: catRows } = await supa.from('categories').select('id,name')
  const catMap = Object.fromEntries(catRows.map(r => [r.name, r.id]))
  console.log(`  ✓ ${catRows.length} categories`)

  // ── 2. Manufacturers ──────────────────────────────────────────────────────
  console.log('2. Manufacturers…')
  const mfrs = sqlite.prepare('SELECT name FROM manufacturers').all()
  await chunk(mfrs, 500, async (batch) => {
    const { error } = await supa.from('manufacturers').upsert(
      batch.map(m => ({ name: m.name })), { onConflict: 'name' }
    )
    if (error) console.error('  mfr error:', error.message)
  })

  const { data: mfrRows } = await supa.from('manufacturers').select('id,name')
  const mfrMap = Object.fromEntries(mfrRows.map(r => [r.name, r.id]))
  console.log(`  ✓ ${mfrRows.length} manufacturers`)

  // ── 3. Products ──────────────────────────────────────────────────────────
  console.log('3. Products (2702)…')
  const prods = sqlite.prepare(`
    SELECT p.*, m.name as mname, c.name as cname
    FROM products p
    LEFT JOIN manufacturers m ON m.id = p.manufacturer_id
    LEFT JOIN categories c ON c.id = p.category_id
  `).all()

  let prodInserted = 0
  await chunk(prods, 400, async (batch, i) => {
    const { error } = await supa.from('products').upsert(
      batch.map(p => ({
        name: p.name,
        code: p.code,
        manufacturer_id: p.mname ? mfrMap[p.mname] ?? null : null,
        category_id: p.cname ? catMap[p.cname] ?? null : null,
        description: p.description ?? '',
        image: p.image ?? '',
        filter_type: p.filter_type ?? '',
        material: p.material ?? '',
        availability: p.availability ?? 'In Stock',
        outer_diameter: p.outer_diameter ?? null,
        inner_diameter: p.inner_diameter ?? null,
        length_mm: p.length_mm ?? null,
        thread: p.thread ?? '',
        micron: p.micron ?? null,
        connection_type: p.connection_type ?? '',
        pressure_rating: p.pressure_rating ?? '',
        rate: p.rate ?? null,
      })),
      { onConflict: 'code' }
    )
    if (error) console.error(`  product batch ${i/400} error:`, error.message)
    else { prodInserted += batch.length; process.stdout.write(`  ${prodInserted}/${prods.length}\r`) }
  })

  // Fetch all product IDs (paginate past the 1000-row default limit)
  let prodRows = [], page = 0
  while (true) {
    const { data } = await supa.from('products').select('id,code').range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    prodRows = prodRows.concat(data)
    if (data.length < 1000) break
    page++
  }
  const prodMap = Object.fromEntries(prodRows.map(r => [r.code, r.id]))
  console.log(`\n  ✓ ${prodRows.length} products`)

  // ── 4. Part numbers ──────────────────────────────────────────────────────
  console.log('4. Part numbers (90k)…')
  const sqliteParts = sqlite.prepare(`
    SELECT pn.*, p.code as pcode FROM part_numbers pn JOIN products p ON p.id = pn.product_id
  `).all()

  let pnInserted = 0, pnSkipped = 0
  await chunk(sqliteParts, 1000, async (batch, i) => {
    const rows = batch.map(pn => {
      const pid = prodMap[pn.pcode]
      if (!pid) { pnSkipped++; return null }
      return { product_id: pid, number: pn.number, normalized: pn.normalized, type: pn.type ?? 'Cross Reference', maker: pn.maker ?? '' }
    }).filter(Boolean)

    if (rows.length === 0) return
    const { error } = await supa.from('part_numbers').upsert(rows, { onConflict: 'product_id,normalized', ignoreDuplicates: true })
    if (error) console.error(`  pn batch error:`, error.message)
    else { pnInserted += rows.length; process.stdout.write(`  ${pnInserted}/${sqliteParts.length}\r`) }
  })
  console.log(`\n  ✓ ${pnInserted} part numbers (${pnSkipped} skipped)`)

  // ── 5. Gaskets ────────────────────────────────────────────────────────────
  console.log('5. Gaskets (1262)…')
  const gaskets = sqlite.prepare('SELECT * FROM gaskets').all()
  await chunk(gaskets, 500, async (batch) => {
    const { error } = await supa.from('gaskets').upsert(
      batch.map(g => ({
        model: g.model,
        sr_no: g.sr_no ?? null,
        part_no: g.part_no,
        die_no: g.die_no ?? '',
        description: g.description ?? '',
        ccn: g.ccn ?? '',
        nos: g.nos ?? 1,
        rate: g.rate ?? null,
        rate_15: g.rate_15 ?? null,
        image: g.image ?? '',
      })),
      { ignoreDuplicates: true }
    )
    if (error) console.error('  gaskets error:', error.message)
  })
  console.log(`  ✓ ${gaskets.length} gaskets`)

  // ── 6. Other tables ──────────────────────────────────────────────────────
  console.log('6. product_specs, product_images, compatible_models, product_applications…')

  const specs = sqlite.prepare('SELECT ps.*, p.code FROM product_specs ps JOIN products p ON p.id=ps.product_id').all()
  if (specs.length) {
    const { error } = await supa.from('product_specs').upsert(
      specs.map(s => ({ product_id: prodMap[s.code], name: s.name, value: s.value })).filter(s => s.product_id)
    )
    if (error) console.error('  specs error:', error.message)
    else console.log(`  ✓ ${specs.length} specs`)
  }

  const images = sqlite.prepare('SELECT pi.*, p.code FROM product_images pi JOIN products p ON p.id=pi.product_id').all()
  if (images.length) {
    const { error } = await supa.from('product_images').upsert(
      images.map(i => ({ product_id: prodMap[i.code], url: i.url, sort: i.sort ?? 0 })).filter(i => i.product_id)
    )
    if (error) console.error('  images error:', error.message)
    else console.log(`  ✓ ${images.length} images`)
  }

  const models = sqlite.prepare('SELECT cm.*, p.code FROM compatible_models cm JOIN products p ON p.id=cm.product_id').all()
  if (models.length) {
    const { error } = await supa.from('compatible_models').upsert(
      models.map(m => ({ product_id: prodMap[m.code], model: m.model, manufacturer: m.manufacturer ?? '' })).filter(m => m.product_id)
    )
    if (error) console.error('  models error:', error.message)
    else console.log(`  ✓ ${models.length} compatible models`)
  }

  const apps = sqlite.prepare('SELECT pa.*, p.code FROM product_applications pa JOIN products p ON p.id=pa.product_id').all()
  if (apps.length) {
    const { error } = await supa.from('product_applications').upsert(
      apps.map(a => ({ product_id: prodMap[a.code], name: a.name })).filter(a => a.product_id)
    )
    if (error) console.error('  apps error:', error.message)
    else console.log(`  ✓ ${apps.length} applications`)
  }

  // ── 7. Users (skip admin, already seeded) ────────────────────────────────
  const extraUsers = sqlite.prepare("SELECT * FROM users WHERE username != 'admin'").all()
  if (extraUsers.length) {
    const { error } = await supa.from('users').upsert(
      extraUsers.map(u => ({
        username: u.username, password_hash: u.password_hash,
        full_name: u.full_name ?? '', role: u.role,
        active: u.active === 1 || u.active === true,
      })),
      { onConflict: 'username' }
    )
    if (error) console.error('  users error:', error.message)
    else console.log(`  ✓ ${extraUsers.length} extra users`)
  }

  // ── Final count ───────────────────────────────────────────────────────────
  console.log('\n=== Done! Verifying counts in Supabase ===')
  const tables = ['products','part_numbers','gaskets','manufacturers','categories','users']
  for (const t of tables) {
    const { count } = await supa.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t}: ${count}`)
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
