import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Boxes, Layers, FileSpreadsheet, Hash, LayoutDashboard, ListPlus, MessageSquareQuote,
  Package, Pencil, Plus, Search, Tags, Trash2, Upload, X, CheckCircle2, AlertTriangle,
  Users, Eye, EyeOff, ShieldCheck, UserCog, RefreshCw,
  BarChart2, Warehouse, Download,
} from 'lucide-react'
import { getJSON, sendJSON, refreshMeta, useMeta, useDebounced, type Product, type QuoteRequest } from '../lib/api'
import { Container, PartTypeBadge, Spinner, btnPrimary, btnGhost, inputCls, labelCls } from '../components/ui'
import { GasketsAdmin } from './GasketsAdmin'
import { useAuth } from '../lib/auth'

type Tab = 'overview' | 'products' | 'gaskets' | 'categories' | 'manufacturers' | 'quotes' | 'import' | 'users' | 'stock' | 'analytics'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'gaskets', label: 'Gaskets & Dies', icon: Layers },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'manufacturers', label: 'Manufacturers', icon: Boxes },
  { id: 'stock', label: 'Stock Status', icon: Warehouse },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'quotes', label: 'Quote Requests', icon: MessageSquareQuote },
  { id: 'import', label: 'Import (Excel/CSV)', icon: FileSpreadsheet },
  { id: 'users', label: 'Users & Access', icon: Users },
]

export function Admin() {
  const [tab, setTab] = useState<Tab>('overview')
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return (
      <Container className="py-24 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-ink-soft/40" />
        <h1 className="mt-4 text-xl font-bold">Admin Access Required</h1>
        <p className="mt-2 text-sm text-ink-soft">You don't have permission to access the admin panel.</p>
      </Container>
    )
  }

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin Dashboard</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Manage the product database, cross-references and quote requests.</p>

      {/* Tab bar */}
      <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === id ? 'text-primary' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {tab === id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && <Overview goTo={setTab} />}
        {tab === 'products' && <ProductsAdmin />}
        {tab === 'gaskets' && <GasketsAdmin />}
        {tab === 'categories' && <CategoriesAdmin />}
        {tab === 'manufacturers' && <ManufacturersAdmin />}
        {tab === 'quotes' && <QuotesAdmin />}
        {tab === 'import' && (
          <div className="animate-fade-in space-y-8">
            <GoogleSheetsImport />
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-soft">or import from CSV / Excel file below</span>
              <div className="h-px flex-1 bg-line" />
            </div>
            <ImportWizard />
          </div>
        )}
        {tab === 'users' && <UsersAdmin />}
        {tab === 'stock' && <StockAdmin />}
        {tab === 'analytics' && <AnalyticsAdmin />}
      </div>
    </Container>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({ goTo }: { goTo: (t: Tab) => void }) {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    getJSON('/api/stats').then(setStats).catch(() => {})
  }, [])


  if (!stats) return <Spinner />

  const cards: [string, number, Tab][] = [
    ['Products', stats.products, 'products'],
    ['Part Numbers', stats.partNumbers, 'products'],
    ['Categories', stats.categories, 'categories'],
    ['Manufacturers', stats.manufacturers, 'manufacturers'],
    ['Gaskets', stats.gaskets, 'gaskets'],
    ['New Quotes', stats.newQuotes, 'quotes'],
  ]

  return (
    <div className="animate-fade-in space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value, target]) => (
          <button
            key={label}
            onClick={() => goTo(target)}
            className="rounded-2xl border border-line p-5 text-left shadow-card transition-colors hover:border-primary/40"
          >
            <p className="text-2xl font-extrabold">{value}</p>
            <p className="mt-1 text-xs font-medium text-ink-soft">{label}</p>
          </button>
        ))}
      </div>

      {/* Export All */}
      <div className="flex flex-wrap gap-3">
        <a href="/api/export/all" className={btnPrimary + ' inline-flex items-center gap-2'}>
          <Download className="h-4 w-4" /> Export Full Catalog (Excel)
        </a>
        <a href="/api/export/products" className={btnGhost + ' inline-flex items-center gap-2'}>
          <Download className="h-4 w-4" /> Products Only
        </a>
        <a href="/api/export/gaskets" className={btnGhost + ' inline-flex items-center gap-2'}>
          <Download className="h-4 w-4" /> Gaskets Only
        </a>
        <a href="/api/export/categories" className={btnGhost + ' inline-flex items-center gap-2'}>
          <Download className="h-4 w-4" /> Categories Only
        </a>
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Products admin
// ---------------------------------------------------------------------------

const IMAGE_OPTIONS = [
  '/img/cat-wirecut.svg', '/img/cat-compressor.svg', '/img/cat-hydraulic.svg', '/img/cat-air.svg',
  '/img/cat-wound.svg', '/img/cat-dust.svg', '/img/cat-generator.svg', '/img/cat-oil.svg',
  '/img/cat-panel.svg', '/img/cat-process.svg',
]

function ProductsAdmin() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getJSON<{ products: Product[] }>(`/api/products?q=${encodeURIComponent(dq)}`)
      .then((r) => setProducts(r.products))
      .finally(() => setLoading(false))
  }, [dq])

  useEffect(load, [load])

  const del = async (p: Product) => {
    if (!confirm(`Delete "${p.name}" and all its part numbers?`)) return
    await sendJSON(`/api/products/${p.id}`, 'DELETE', {})
    refreshMeta()
    load()
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/60" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className={`${inputCls} pl-10`} />
        </div>
        <div className="flex gap-2">
          <a href="/api/export/products" className={btnGhost + ' inline-flex items-center gap-2'}>
            <Download className="h-4 w-4" /> Export Excel
          </a>
          <button onClick={() => setEditing('new')} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Manufacturer</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Part Nos.</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-line hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt="" className="h-9 w-12 rounded-md border border-line object-cover" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-3">{p.manufacturer}</td>
                  <td className="px-4 py-3">{p.category}</td>
                  <td className="px-4 py-3">{p.part_count}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${p.availability === 'In Stock' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {p.availability}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(p)} aria-label="Edit" className="rounded-lg p-2 text-ink-soft hover:bg-primary-light hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => del(p)} aria-label="Delete" className="rounded-lg p-2 text-ink-soft hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-soft">No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          onClose={(saved) => { setEditing(null); if (saved) { refreshMeta(); load() } }}
        />
      )}
    </div>
  )
}

function ProductEditor({ product, onClose }: { product: Product | null; onClose: (saved: boolean) => void }) {
  const meta = useMeta()
  const [f, setF] = useState({
    name: product?.name ?? '',
    code: product?.code ?? '',
    manufacturer: product?.manufacturer ?? '',
    category: product?.category ?? '',
    description: product?.description ?? '',
    image: product?.image ?? IMAGE_OPTIONS[9],
    images: (product as any)?.images ?? [] as string[],
    filter_type: product?.filter_type ?? '',
    material: product?.material ?? '',
    availability: product?.availability ?? 'In Stock',
    outer_diameter: product?.outer_diameter?.toString() ?? '',
    inner_diameter: product?.inner_diameter?.toString() ?? '',
    largest_od: (product as any)?.largest_od?.toString() ?? '',
    body_height: (product as any)?.body_height?.toString() ?? '',
    length_mm: product?.length_mm?.toString() ?? '',
    thread: product?.thread ?? '',
    micron: product?.micron?.toString() ?? '',
    top_cap: (product as any)?.top_cap ?? '',
    bottom_cap: (product as any)?.bottom_cap ?? '',
    connection_type: product?.connection_type ?? '',
    pressure_rating: product?.pressure_rating ?? '',
    rate: product?.rate?.toString() ?? '',
  })
  const [parts, setParts] = useState<{ id?: number; number: string; type: string; maker: string }[]>(
    product?.part_numbers?.map((n) => ({ id: n.id, number: n.number, type: n.type, maker: n.maker })) ?? [],
  )
  const [newPart, setNewPart] = useState({ number: '', type: 'Cross Reference', maker: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }))

  const num = (s: string) => (s === '' ? null : Number(s))

  const uploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setF((v) => ({ ...v, image: reader.result as string }))
    reader.readAsDataURL(file)
  }

  const uploadExtraImage = (slot: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setF((v) => {
      const imgs = [...((v as any).images ?? [])]
      imgs[slot] = reader.result as string
      return { ...v, images: imgs }
    })
    reader.readAsDataURL(file)
  }

  const removeExtraImage = (slot: number) => {
    setF((v) => {
      const imgs = [...((v as any).images ?? [])]
      imgs.splice(slot, 1)
      return { ...v, images: imgs }
    })
  }

  const addPart = async () => {
    if (!newPart.number.trim()) return
    if (product) {
      const r = await sendJSON<{ id: number }>(`/api/products/${product.id}/part-numbers`, 'POST', newPart)
      setParts((p) => [...p, { ...newPart, id: r.id }])
    } else {
      setParts((p) => [...p, { ...newPart }])
    }
    setNewPart({ number: '', type: 'Cross Reference', maker: '' })
  }

  const removePart = async (i: number) => {
    const pn = parts[i]
    if (pn.id) await sendJSON(`/api/part-numbers/${pn.id}`, 'DELETE', {})
    setParts((p) => p.filter((_, idx) => idx !== i))
  }

  const save = async () => {
    setSaving(true); setError('')
    const body = {
      ...f,
      outer_diameter: num(f.outer_diameter),
      inner_diameter: num(f.inner_diameter),
      largest_od: num((f as any).largest_od),
      body_height: num((f as any).body_height),
      length_mm: num(f.length_mm),
      micron: num(f.micron),
      rate: num(f.rate),
      images: ((f as any).images ?? []).filter(Boolean),
      part_numbers: product ? undefined : parts,
    }
    try {
      if (product) await sendJSON(`/api/products/${product.id}`, 'PUT', body)
      else await sendJSON('/api/products', 'POST', body)
      onClose(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const selectCls = inputCls + ' appearance-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center animate-fade-in" onClick={() => onClose(false)}>
      <div
        className="animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-pop sm:max-w-3xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{product ? `Edit — ${product.name}` : 'Add Product'}</h2>
          <button onClick={() => onClose(false)} aria-label="Close" className="rounded-lg p-1.5 text-ink-soft hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>Product Name *</label><input className={inputCls} value={f.name} onChange={set('name')} /></div>
          <div><label className={labelCls}>Product Code *</label><input className={inputCls} value={f.code} onChange={set('code')} /></div>
          <div>
            <label className={labelCls}>Manufacturer</label>
            <input className={inputCls} list="mk-list" value={f.manufacturer} onChange={set('manufacturer')} placeholder="Type or pick…" />
            <datalist id="mk-list">{meta?.manufacturers.map((m) => <option key={m.id} value={m.name} />)}</datalist>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input className={inputCls} list="cat-list" value={f.category} onChange={set('category')} placeholder="Type or pick…" />
            <datalist id="cat-list">{meta?.categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea rows={2} className={inputCls} value={f.description} onChange={set('description')} />
          </div>
          <div><label className={labelCls}>Filter Type</label><input className={inputCls} value={f.filter_type} onChange={set('filter_type')} /></div>
          <div><label className={labelCls}>Material</label><input className={inputCls} value={f.material} onChange={set('material')} /></div>
          <div><label className={labelCls}>Outer Ø (mm)</label><input type="number" className={inputCls} value={f.outer_diameter} onChange={set('outer_diameter')} /></div>
          <div><label className={labelCls}>Largest Outer Ø (mm)</label><input type="number" className={inputCls} value={(f as any).largest_od} onChange={set('largest_od')} /></div>
          <div><label className={labelCls}>Inner Ø (mm)</label><input type="number" className={inputCls} value={f.inner_diameter} onChange={set('inner_diameter')} /></div>
          <div><label className={labelCls}>Total Height / Length (mm)</label><input type="number" className={inputCls} value={f.length_mm} onChange={set('length_mm')} /></div>
          <div><label className={labelCls}>Body Height (mm)</label><input type="number" className={inputCls} value={(f as any).body_height} onChange={set('body_height')} /></div>
          <div><label className={labelCls}>Micron</label><input type="number" className={inputCls} value={f.micron} onChange={set('micron')} /></div>
          <div><label className={labelCls}>Thread</label><input className={inputCls} value={f.thread} onChange={set('thread')} /></div>
          <div>
            <label className={labelCls}>Top Cap</label>
            <input className={inputCls} list="top-cap-list" value={(f as any).top_cap} onChange={set('top_cap')} placeholder="e.g. Male Thread" />
            <datalist id="top-cap-list">
              {['Male Thread','Male Threaded-Rod','Male single O-ring','Male double O-ring','Male Flat single O-ring','Male Bayonet Lock','Open Hat','Female center hole','Male Protrusions','Male Ball Joint','Male Reducing'].map(v => <option key={v} value={v}/>)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Bottom Cap</label>
            <input className={inputCls} list="bot-cap-list" value={(f as any).bottom_cap} onChange={set('bottom_cap')} placeholder="e.g. Closed" />
            <datalist id="bot-cap-list">
              {['Closed','Legs','Trapezoid','Open Grille','Closed Grille','Center Hole','Interrupted Flange','Propeller'].map(v => <option key={v} value={v}/>)}
            </datalist>
          </div>
          <div><label className={labelCls}>Connection</label><input className={inputCls} value={f.connection_type} onChange={set('connection_type')} /></div>
          <div><label className={labelCls}>Pressure Rating</label><input className={inputCls} value={f.pressure_rating} onChange={set('pressure_rating')} /></div>
          <div><label className={labelCls}>Rate ₹ (internal only)</label><input type="number" className={inputCls} value={f.rate} onChange={set('rate')} /></div>
          <div>
            <label className={labelCls}>Availability</label>
            <select className={selectCls} value={f.availability} onChange={set('availability')}>
              <option>In Stock</option><option>On Request</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Product Images (max 4 — different angles)</label>
            <div className="grid grid-cols-4 gap-3 mt-2">
              {/* Slot 0 — main image */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="relative h-24 w-full rounded-lg border-2 border-dashed border-line bg-surface flex items-center justify-center overflow-hidden">
                  <img src={f.image} alt="" className="h-full w-full object-cover rounded-lg" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[9px] text-white">Main</span>
                </div>
                <div className="flex gap-1 w-full">
                  <select className="flex-1 text-[10px] rounded border border-line px-1 py-1 bg-white" value={IMAGE_OPTIONS.includes(f.image) ? f.image : ''} onChange={set('image')}>
                    <option value="" disabled>Stock…</option>
                    {IMAGE_OPTIONS.map((i) => <option key={i} value={i}>{i.replace('/img/cat-', '').replace('.svg', '')}</option>)}
                  </select>
                  <label className="cursor-pointer rounded border border-line bg-white px-1.5 py-1 text-[10px] text-ink-soft hover:bg-surface flex items-center gap-0.5">
                    <Upload className="h-3 w-3" />
                    <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                  </label>
                </div>
              </div>
              {/* Slots 1–3 — extra angles */}
              {[0, 1, 2].map((slot) => {
                const imgs = (f as any).images ?? []
                const src = imgs[slot]
                return (
                  <div key={slot} className="flex flex-col items-center gap-1.5">
                    <div className="relative h-24 w-full rounded-lg border-2 border-dashed border-line bg-surface flex items-center justify-center overflow-hidden">
                      {src
                        ? <>
                            <img src={src} alt="" className="h-full w-full object-cover rounded-lg" />
                            <button onClick={() => removeExtraImage(slot)} className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white hover:bg-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        : <span className="text-[10px] text-ink-soft">Angle {slot + 2}</span>
                      }
                    </div>
                    <label className="cursor-pointer w-full rounded border border-line bg-white px-2 py-1 text-[10px] text-ink-soft hover:bg-surface flex items-center justify-center gap-1">
                      <Upload className="h-3 w-3" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={uploadExtraImage(slot)} />
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Part numbers */}
        <div className="mt-6 rounded-xl border border-line p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Hash className="h-4 w-4 text-primary" /> OEM &amp; Cross-Reference Numbers</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {parts.map((pn, i) => (
              <span key={i} className="inline-flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs">
                <span className="font-mono font-semibold">{pn.number}</span>
                <PartTypeBadge type={pn.type} />
                {pn.maker && <span className="text-ink-soft">{pn.maker}</span>}
                <button onClick={() => removePart(i)} aria-label={`Remove ${pn.number}`} className="text-ink-soft hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
            {parts.length === 0 && <p className="text-xs text-ink-soft">No part numbers yet — add the OEM number and every cross-reference below.</p>}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_170px_1fr_auto]">
            <input className={inputCls} placeholder="Part number" value={newPart.number} onChange={(e) => setNewPart((p) => ({ ...p, number: e.target.value }))} />
            <select className={selectCls} value={newPart.type} onChange={(e) => setNewPart((p) => ({ ...p, type: e.target.value }))}>
              <option>OEM</option><option>Cross Reference</option><option>Alternative</option>
            </select>
            <input className={inputCls} placeholder="Maker (e.g. Donaldson)" value={newPart.maker} onChange={(e) => setNewPart((p) => ({ ...p, maker: e.target.value }))} />
            <button onClick={addPart} className={btnGhost + ' px-4'}><ListPlus className="h-4 w-4" /> Add</button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => onClose(false)} className={btnGhost}>Cancel</button>
          <button onClick={save} disabled={saving || !f.name || !f.code} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Categories & manufacturers admin
// ---------------------------------------------------------------------------

function CategoriesAdmin() {
  const meta = useMeta()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaved(false)
    try {
      await sendJSON('/api/categories', 'POST', { name, description })
      refreshMeta(); setName(''); setDescription(''); setSaved(true)
    } catch (err: any) { setError(err.message) }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-end">
        <a href="/api/export/categories" className={btnGhost + ' inline-flex items-center gap-2'}>
          <Download className="h-4 w-4" /> Export Excel
        </a>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <form onSubmit={add} className="h-fit rounded-2xl border border-line p-6 shadow-card">
        <h3 className="font-bold">Add Category</h3>
        <div className="mt-4 space-y-4">
          <div><label className={labelCls}>Name *</label><input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className={labelCls}>Description</label><textarea rows={2} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Category added.</p>}
          <button className={btnPrimary}><Plus className="h-4 w-4" /> Add Category</button>
        </div>
      </form>
      <div className="rounded-2xl border border-line shadow-card">
        <h3 className="border-b border-line px-6 py-4 font-bold">Existing Categories</h3>
        <ul className="divide-y divide-line">
          {meta?.categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-6 py-3 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-ink-soft">{c.product_count} products</span>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  )
}

function ManufacturersAdmin() {
  const meta = useMeta()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaved(false)
    try {
      await sendJSON('/api/manufacturers', 'POST', { name })
      refreshMeta(); setName(''); setSaved(true)
    } catch (err: any) { setError(err.message) }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-end">
        <a href="/api/export/products" className={btnGhost + ' inline-flex items-center gap-2'}>
          <Download className="h-4 w-4" /> Export Products Excel
        </a>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <form onSubmit={add} className="h-fit rounded-2xl border border-line p-6 shadow-card">
        <h3 className="font-bold">Add Manufacturer</h3>
        <div className="mt-4 space-y-4">
          <div><label className={labelCls}>Name *</label><input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Manufacturer added.</p>}
          <button className={btnPrimary}><Plus className="h-4 w-4" /> Add Manufacturer</button>
        </div>
      </form>
      <div className="rounded-2xl border border-line shadow-card">
        <h3 className="border-b border-line px-6 py-4 font-bold">Existing Manufacturers</h3>
        <ul className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
          {meta?.manufacturers.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-6 py-3 text-sm">
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-ink-soft">{m.product_count}</span>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quotes admin
// ---------------------------------------------------------------------------

const QUOTE_STATUSES = ['New', 'Contacted', 'Quoted', 'Won', 'Closed']

function QuotesAdmin() {
  const [quotes, setQuotes] = useState<QuoteRequest[] | null>(null)

  const load = useCallback(() => {
    getJSON<{ quotes: QuoteRequest[] }>('/api/quotes').then((r) => setQuotes(r.quotes))
  }, [])
  useEffect(load, [load])

  const setStatus = async (id: number, status: string) => {
    await sendJSON(`/api/quotes/${id}`, 'PATCH', { status })
    load()
  }

  if (!quotes) return <Spinner />
  if (quotes.length === 0) {
    return <p className="rounded-2xl border border-line bg-surface px-6 py-12 text-center text-sm text-ink-soft animate-fade-in">No quote requests yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line animate-fade-in">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-ink-soft">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3">Product / Part</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Message</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id} className="border-t border-line align-top hover:bg-surface/50">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{q.created_at?.slice(0, 10)}</td>
              <td className="px-4 py-3">
                <p className="font-medium">{q.name}</p>
                <p className="text-xs text-ink-soft">{q.company}</p>
                <p className="text-xs text-primary">{q.email}</p>
                {q.phone && <p className="text-xs text-ink-soft">{q.phone}</p>}
              </td>
              <td className="px-4 py-3">
                <p>{q.product || '—'}</p>
                {q.part_number && <p className="font-mono text-xs text-ink-soft">{q.part_number}</p>}
              </td>
              <td className="px-4 py-3">{q.quantity || '—'}</td>
              <td className="max-w-56 px-4 py-3 text-xs text-ink-soft">{q.message}</td>
              <td className="px-4 py-3">
                <select
                  value={q.status}
                  onChange={(e) => setStatus(q.id, e.target.value)}
                  className={`rounded-lg border border-line px-2 py-1.5 text-xs font-semibold ${q.status === 'New' ? 'text-accent' : 'text-ink'}`}
                >
                  {QUOTE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV import wizard: Upload → Preview → Map columns → Validate → Import
// ---------------------------------------------------------------------------

/** Minimal CSV parser handling quoted fields and embedded commas/newlines. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

const IMPORT_FIELDS: { key: string; label: string; required?: boolean; hint: string }[] = [
  { key: 'model', label: 'Model / Product Name', required: true, hint: 'e.g. SC4 — rows with the same model merge into one product' },
  { key: 'manufacturer', label: 'Manufacturer', hint: 'e.g. Ingersoll Rand' },
  { key: 'part_number', label: 'Part / Cross-Reference Number', required: true, hint: 'e.g. 32170979 — one per row' },
  { key: 'part_type', label: 'Part Number Type', hint: 'OEM / Cross Reference (optional)' },
  { key: 'part_maker', label: 'Part Number Maker', hint: 'Brand of that specific number (optional)' },
  { key: 'category', label: 'Category', hint: 'Created automatically if new' },
  { key: 'description', label: 'Description', hint: '' },
  { key: 'od', label: 'Outer Diameter (mm)', hint: '' },
  { key: 'idm', label: 'Inner Diameter (mm)', hint: '' },
  { key: 'length', label: 'Length (mm)', hint: '' },
  { key: 'thread', label: 'Thread', hint: '' },
  { key: 'micron', label: 'Micron Rating', hint: '' },
  { key: 'material', label: 'Material', hint: '' },
  { key: 'filter_type', label: 'Filter Type', hint: '' },
]

/** Guess a column mapping from header names. */
function guessMapping(headers: string[]): Record<string, string> {
  const m: Record<string, string> = {}
  const find = (...needles: string[]) =>
    headers.find((h) => needles.some((n) => h.toLowerCase().replace(/[^a-z]/g, '').includes(n))) ?? ''
  m.model = find('model', 'productname', 'product')
  m.manufacturer = find('manufacturer', 'make', 'brand', 'oem')
  m.part_number = find('partnumber', 'partno', 'crossreference', 'reference', 'number')
  m.part_type = find('parttype', 'type')
  m.category = find('category')
  m.description = find('description', 'desc')
  m.od = find('outerdiameter', 'od')
  m.idm = find('innerdiameter', 'id')
  m.length = find('length', 'height')
  m.thread = find('thread')
  m.micron = find('micron')
  m.material = find('material', 'media')
  m.filter_type = find('filtertype')
  // never map two fields to the same column accidentally for the required ones
  if (m.model && m.model === m.part_number) m.part_number = ''
  return m
}

function GoogleSheetsImport() {
  const [url, setUrl] = useState<string>(() => { try { return localStorage.getItem('gsheet_url') ?? '' } catch { return '' } })
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const saveUrl = (v: string) => { setUrl(v); try { localStorage.setItem('gsheet_url', v) } catch {} }

  const sync = async () => {
    if (!url.trim()) return
    setSyncing(true); setResult(null); setError('')
    try {
      const r = await fetch('/api/import/gsheet', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const data = await r.json()
      if (!r.ok) setError(data.error ?? 'Sync failed')
      else setResult(data)
    } catch (e: any) { setError(e.message) }
    setSyncing(false)
  }

  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
        <h3 className="font-bold text-ink">Google Sheets Import</h3>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">Live</span>
      </div>
      <p className="text-xs text-ink-soft mb-4">
        Paste your Google Sheet URL below. The sheet must be set to <strong>"Anyone with the link → Viewer"</strong>.
        Name your tabs exactly: <span className="font-mono text-ink">Products</span>, <span className="font-mono text-ink">Gaskets</span>, <span className="font-mono text-ink">Categories</span>.
      </p>

      <div className="flex gap-2">
        <input
          className={inputCls + ' flex-1'}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={url}
          onChange={(e) => saveUrl(e.target.value)}
        />
        <button onClick={sync} disabled={syncing || !url.trim()} className={btnPrimary + ' shrink-0'}>
          {syncing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Syncing…</> : <><RefreshCw className="h-4 w-4" /> Sync Now</>}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Sync complete</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
            {result.products && (
              <div className="rounded-lg bg-white border border-emerald-100 p-3">
                <p className="font-bold text-ink">Products</p>
                <p className="text-ink-soft">{result.products.synced} synced · {result.products.skipped} skipped</p>
                <p className="text-ink-soft">{result.products.partNumbers} part numbers</p>
              </div>
            )}
            {result.gaskets && (
              <div className="rounded-lg bg-white border border-emerald-100 p-3">
                <p className="font-bold text-ink">Gaskets</p>
                <p className="text-ink-soft">{result.gaskets.synced} synced · {result.gaskets.skipped} skipped</p>
              </div>
            )}
            {result.categories && (
              <div className="rounded-lg bg-white border border-emerald-100 p-3">
                <p className="font-bold text-ink">Categories</p>
                <p className="text-ink-soft">{result.categories.synced} synced</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-line bg-surface/60 px-4 py-3 text-xs text-ink-soft space-y-1">
        <p className="font-semibold text-ink">Column names required in each tab</p>
        <p><span className="font-mono text-primary">Products:</span> Code · Name · Category · Manufacturer · Description · Filter Type · Material · OD (mm) · ID (mm) · Length (mm) · Thread · Micron · Availability · Part Numbers</p>
        <p><span className="font-mono text-primary">Gaskets:</span> Model · Part No · Die No · Description · CCN · Rate</p>
        <p><span className="font-mono text-primary">Categories:</span> Name · Description</p>
        <p className="pt-1">Tip: use <a href="/api/export/all" className="text-primary underline">Export Full Catalog</a> to get a pre-filled template you can edit.</p>
      </div>
    </div>
  )
}

function ImportWizard() {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [xlsxResult, setXlsxResult] = useState<any>(null)
  const [xlsxErr, setXlsxErr] = useState('')
  const [xlsxLoading, setXlsxLoading] = useState(false)

  const uploadXlsx = async (e: React.ChangeEvent<HTMLInputElement>, type: 'filters' | 'gaskets') => {
    const file = e.target.files?.[0]
    if (!file) return
    setXlsxErr(''); setXlsxResult(null); setXlsxLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    const endpoint = type === 'filters' ? '/api/import/xlsx' : '/api/import/xlsx-gaskets'
    const r = await fetch(endpoint, { method: 'POST', credentials: 'include', body: fd })
    const data = await r.json()
    setXlsxLoading(false)
    if (!r.ok) setXlsxErr(data.error ?? 'Import failed')
    else setXlsxResult({ ...data, type })
    e.target.value = ''
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result))
      if (parsed.length < 2) { setError('The file needs a header row plus at least one data row.'); return }
      const hdrs = parsed[0].map((h) => h.trim())
      setHeaders(hdrs)
      setRows(parsed.slice(1).map((r) => Object.fromEntries(hdrs.map((h, i) => [h, (r[i] ?? '').trim()]))))
      setMapping(guessMapping(hdrs))
      setFileName(file.name)
    }
    reader.readAsText(file)
  }

  const validation = useMemo(() => {
    if (!rows.length) return null
    if (!mapping.model || !mapping.part_number) return { ok: false, msg: 'Map the required columns: Model and Part Number.' }
    const bad = rows.filter((r) => !(r[mapping.model] ?? '').trim() || !(r[mapping.part_number] ?? '').trim()).length
    const models = new Set(rows.map((r) => `${(r[mapping.model] ?? '').trim().toLowerCase()}|${mapping.manufacturer ? (r[mapping.manufacturer] ?? '').trim().toLowerCase() : ''}`))
    models.delete('|')
    return {
      ok: true,
      msg: `${rows.length} rows → about ${models.size} products` + (bad ? ` · ${bad} rows will be skipped (missing model or part number)` : ''),
    }
  }, [rows, mapping])

  const runImport = async () => {
    setImporting(true); setError('')
    try {
      const r = await sendJSON('/api/import', 'POST', { rows, mapping })
      setResult(r)
      refreshMeta()
    } catch (e: any) { setError(e.message) } finally { setImporting(false) }
  }

  const reset = () => { setHeaders([]); setRows([]); setMapping({}); setResult(null); setFileName(''); setError('') }

  if (result) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line p-8 text-center shadow-card animate-fade-in">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h3 className="mt-4 text-lg font-bold">Import complete</h3>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[[result.productsCreated, 'Products created'], [result.partsAdded, 'Part numbers added'], [result.skipped, 'Rows skipped']].map(([v, l]) => (
            <div key={String(l)} className="rounded-xl bg-surface p-4">
              <p className="text-2xl font-extrabold">{v}</p>
              <p className="mt-1 text-xs text-ink-soft">{l}</p>
            </div>
          ))}
        </div>
        {result.errors?.length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-left text-xs text-amber-800">
            {result.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}
          </div>
        )}
        <button onClick={reset} className={btnPrimary + ' mt-6'}>Import Another File</button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">

      {/* ── Direct Excel (.xlsx) upload ── */}
      <div className="mb-8 rounded-xl border border-line bg-white p-6">
        <h3 className="mb-1 font-bold text-ink">Direct Excel Import</h3>
        <p className="mb-5 text-xs text-ink-soft">Upload your <strong>.xlsx</strong> file directly — no conversion needed. Supports both filter sheets (SC.xlsx style) and gasket sheets.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-line bg-surface/50 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary-light/30">
            <FileSpreadsheet className="h-8 w-8 text-primary/60" />
            <p className="mt-3 font-semibold text-sm">SC Excel</p>
            <p className="mt-1 text-xs text-ink-soft">Columns: Code · Name · Category · Manufacturer · Part Numbers · dimensions. No new columns added.</p>
            <span className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white">Choose .xlsx</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => uploadXlsx(e, 'filters')} />
          </label>
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-line bg-surface/50 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary-light/30">
            <FileSpreadsheet className="h-8 w-8 text-accent/60" />
            <p className="mt-3 font-semibold text-sm">Gaskets Excel</p>
            <p className="mt-1 text-xs text-ink-soft">Shree Sukhram style — model sections, part no, Si die, CCN, rate</p>
            <span className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white">Choose .xlsx</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => uploadXlsx(e, 'gaskets')} />
          </label>
        </div>
        {xlsxLoading && <div className="mt-4 flex items-center gap-2 text-sm text-ink-soft"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /> Importing…</div>}
        {xlsxErr && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{xlsxErr}</p>}
        {xlsxResult && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mr-2 inline h-4 w-4" />
            {xlsxResult.type === 'filters'
              ? `Filters: ${xlsxResult.added} added, ${xlsxResult.updated} updated, ${xlsxResult.skipped} skipped.`
              : `Gaskets: ${xlsxResult.added} rows added, ${xlsxResult.skipped} skipped.`}
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-soft">or use CSV import below</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* Step 1 — upload */}
      {rows.length === 0 && (
        <div className="mx-auto max-w-xl">
          <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-line bg-surface/50 px-6 py-14 text-center transition-colors hover:border-primary/50 hover:bg-primary-light/30">
            <Upload className="h-10 w-10 text-ink-soft/50" />
            <p className="mt-4 font-semibold">Upload a CSV file</p>
            <p className="mt-1 max-w-sm text-xs text-ink-soft">
              Export your Excel sheet as CSV. Each row is one part number; rows sharing a model +
              manufacturer merge into a single product with many cross-references.
            </p>
            <span className={btnPrimary + ' mt-5'}>Choose File</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
          <div className="mt-6 rounded-xl border border-line p-4 text-xs text-ink-soft">
            <p className="font-semibold text-ink">Expected shape (example)</p>
            <pre className="no-scrollbar mt-2 overflow-x-auto font-mono">{`Model,Manufacturer,Part Number
Sc4,Ingersoll Rand,32170979
Sc4,Ingersoll Rand,32282196
Sc4,Ingersoll Rand,CA-2246`}</pre>
          </div>
        </div>
      )}

      {/* Steps 2–4 — preview, map, validate */}
      {rows.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{fileName}</span>
              <span className="text-ink-soft"> — {rows.length} data rows, {headers.length} columns</span>
            </p>
            <button onClick={reset} className="text-sm font-medium text-ink-soft hover:text-red-600">Start over</button>
          </div>

          {/* Preview */}
          <div className="no-scrollbar mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface uppercase tracking-wide text-ink-soft">
                <tr>{headers.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 6).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {headers.map((h) => <td key={h} className="whitespace-nowrap px-3 py-2 font-mono">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 6 && <p className="border-t border-line bg-surface/50 px-3 py-2 text-center text-[11px] text-ink-soft">… and {rows.length - 6} more rows</p>}
          </div>

          {/* Mapping */}
          <h3 className="mt-8 font-bold">Map Columns</h3>
          <p className="mt-1 text-xs text-ink-soft">Match your spreadsheet columns to catalogue fields. Only Model and Part Number are required.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_FIELDS.map((fld) => (
              <div key={fld.key} className="rounded-xl border border-line p-3">
                <label className={labelCls}>
                  {fld.label} {fld.required && <span className="text-accent">*</span>}
                </label>
                <select
                  className={inputCls + ' appearance-none'}
                  value={mapping[fld.key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [fld.key]: e.target.value }))}
                >
                  <option value="">— not mapped —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                {fld.hint && <p className="mt-1.5 text-[11px] text-ink-soft">{fld.hint}</p>}
              </div>
            ))}
          </div>

          {/* Validate + import */}
          {validation && (
            <div className={`mt-6 flex items-start gap-3 rounded-xl p-4 text-sm ${validation.ok ? 'bg-primary-light text-ink' : 'bg-amber-50 text-amber-800'}`}>
              {validation.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              {validation.msg}
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button onClick={runImport} disabled={!validation?.ok || importing} className={btnPrimary + ' mt-5 w-full sm:w-auto sm:px-10'}>
            {importing ? 'Importing…' : 'Validate & Import'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Users & Access Management ─────────────────────────────────────────────────
interface AppUser { id: number; username: string; full_name: string; role: string; active: number; created_at: string; last_login: string | null }

function UsersAdmin() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'staff' })
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editPw, setEditPw] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/auth/users', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { setUsers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('')
    if (!form.username || !form.password) return setErr('Username and password required')
    setSaving(true)
    const r = await fetch('/api/auth/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await r.json()
    setSaving(false)
    if (!r.ok) return setErr(data.error ?? 'Failed')
    setMsg(`User "${form.username}" created.`)
    setForm({ username: '', password: '', full_name: '', role: 'staff' })
    load()
  }

  const toggleActive = async (u: AppUser) => {
    await fetch(`/api/auth/users/${u.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: u.active ? 0 : 1 }) })
    load()
  }

  const resetPassword = async (id: number) => {
    if (!editPw.trim()) return
    await fetch(`/api/auth/users/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: editPw }) })
    setEditId(null); setEditPw(''); setMsg('Password updated.')
  }

  const deleteUser = async (u: AppUser) => {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    await fetch(`/api/auth/users/${u.id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  return (
    <div className="animate-fade-in space-y-10">
      {/* Create user */}
      <div className="rounded-xl border border-line bg-white p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold"><UserCog className="h-4 w-4 text-primary" /> Add New User</h3>
        {err && <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</p>}
        {msg && <p className="mb-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{msg}</p>}
        <form onSubmit={createUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Full Name</label>
            <input className={inputCls} placeholder="e.g. Ravi Sharma" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Username <span className="text-accent">*</span></label>
            <input className={inputCls} placeholder="e.g. ravi123" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div>
            <label className={labelCls}>Password <span className="text-accent">*</span></label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className={inputCls + ' pr-10'} placeholder="Min 6 chars" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft/50">
                {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls + ' appearance-none'} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Staff (search only)</option>
              <option value="admin">Admin (full access)</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={saving} className={btnPrimary + ' w-full sm:w-auto sm:px-10'}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>

      {/* User list */}
      <div>
        <h3 className="mb-3 font-bold">All Users</h3>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-sm">
              <thead className="bg-surface text-xs text-ink-soft">
                <tr>
                  {['Name', 'Username', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {users.map((u) => (
                  <tr key={u.id} className={!u.active ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 font-medium">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${u.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-surface text-ink-soft'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${u.active ? 'text-emerald-600' : 'text-red-500'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== me?.id && (
                        <div className="flex items-center gap-2">
                          {editId === u.id ? (
                            <>
                              <input type="password" placeholder="New password" className="rounded-md border border-line px-2 py-1 text-xs w-32" value={editPw} onChange={(e) => setEditPw(e.target.value)} />
                              <button onClick={() => resetPassword(u.id)} className="text-xs font-semibold text-primary hover:underline">Save</button>
                              <button onClick={() => { setEditId(null); setEditPw('') }} className="text-xs text-ink-soft hover:underline">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setEditId(u.id)} className="text-xs font-medium text-primary hover:underline">Reset PW</button>
                              <button onClick={() => toggleActive(u)} className={`text-xs font-medium hover:underline ${u.active ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {u.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button onClick={() => deleteUser(u)} className="text-xs font-medium text-red-500 hover:underline">Delete</button>
                            </>
                          )}
                        </div>
                      )}
                      {u.id === me?.id && <span className="text-xs text-ink-soft italic">You</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stock Status Management
// ---------------------------------------------------------------------------

const AVAILABILITY_OPTIONS = ['In Stock', 'Out of Stock', 'On Request'] as const

function StockAdmin() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<{ code: string; name: string; old: string; new: string }[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    getJSON<{ products: any[] }>('/api/products?limit=5000').then((d) => {
      setProducts(d.products ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  )

  const setChange = (code: string, val: string) => setChanges((prev) => ({ ...prev, [code]: val }))

  const handleCsvUpload = async (file: File) => {
    setCsvFile(file)
    const text = await file.text()
    const lines = text.trim().split('\n').slice(1) // skip header
    const preview: typeof csvPreview = []
    for (const line of lines) {
      const parts = line.match(/("(?:[^"]|"")*"|[^,]+)(?:,|$)/g)?.map((s) => s.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) ?? []
      const [code, , avail] = parts
      if (!code || !avail) continue
      const prod = products.find((p) => p.code === code.trim())
      if (!prod) continue
      const newAvail = avail.trim()
      if (!AVAILABILITY_OPTIONS.includes(newAvail as any)) continue
      if (prod.availability !== newAvail) preview.push({ code: prod.code, name: prod.name, old: prod.availability, new: newAvail })
    }
    setCsvPreview(preview)
  }

  const applyChanges = async (updates: { code: string; availability: string }[]) => {
    if (!updates.length) return
    setSaving(true); setMsg('')
    try {
      const r = await sendJSON('/api/admin/availability', 'POST', { updates }) as any
      setMsg(`✓ Updated ${r.updated} products`)
      setChanges({})
      setCsvPreview([])
      setCsvFile(null)
      const d = await getJSON<{ products: any[] }>('/api/products?limit=5000')
      setProducts(d.products ?? [])
    } catch { setMsg('Error saving') }
    setSaving(false)
  }

  const downloadTemplate = () => {
    window.open('/api/admin/availability', '_blank')
  }

  const inlineUpdates = Object.entries(changes).map(([code, availability]) => ({ code, availability }))

  if (loading) return <Spinner />

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Stock Status</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Update availability in bulk via CSV or individually here.</p>
        </div>
        <button onClick={downloadTemplate} className={`${btnGhost} flex items-center gap-2`}>
          <Download className="h-4 w-4" /> Download CSV Template
        </button>
      </div>

      {/* CSV Upload */}
      <div className="rounded-xl border border-line p-5">
        <h3 className="text-sm font-bold">Bulk Update via CSV</h3>
        <p className="mt-1 text-xs text-ink-soft">Upload the downloaded CSV with the Availability column updated. Valid values: <span className="font-mono">In Stock</span>, <span className="font-mono">Out of Stock</span>, <span className="font-mono">On Request</span></p>
        <input
          type="file" accept=".csv"
          className="mt-3 block text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-dark"
          onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
        />
        {csvPreview.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-ink mb-2">{csvPreview.length} changes detected</p>
            <div className="overflow-x-auto rounded-lg border border-line max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface"><tr>
                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-left font-semibold">Current</th>
                  <th className="px-3 py-2 text-left font-semibold">→ New</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {csvPreview.map((r) => (
                    <tr key={r.code}>
                      <td className="px-3 py-2 font-mono">{r.code}</td>
                      <td className="px-3 py-2 text-ink-soft truncate max-w-[200px]">{r.name}</td>
                      <td className="px-3 py-2 text-ink-soft">{r.old}</td>
                      <td className="px-3 py-2 font-semibold text-primary">{r.new}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => applyChanges(csvPreview.map((r) => ({ code: r.code, availability: r.new })))}
              disabled={saving}
              className={`${btnPrimary} mt-3 flex items-center gap-2`}
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Apply {csvPreview.length} Changes
            </button>
          </div>
        )}
      </div>

      {/* Inline table */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-sm font-bold">All Products ({products.length})</h3>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or name…"
            className={`${inputCls} h-8 text-xs max-w-xs`}
          />
          {Object.keys(changes).length > 0 && (
            <button onClick={() => applyChanges(inlineUpdates)} disabled={saving} className={`${btnPrimary} ml-auto flex items-center gap-2`}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Save {Object.keys(changes).length} Changes
            </button>
          )}
        </div>
        {msg && <p className="mb-3 text-sm font-medium text-emerald-600">{msg}</p>}
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs font-semibold text-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Product Name</th>
                <th className="px-4 py-3 text-left">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.slice(0, 200).map((p) => (
                <tr key={p.id} className={changes[p.code] ? 'bg-amber-50' : ''}>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-2.5 text-ink-soft max-w-xs truncate">{p.name}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={changes[p.code] ?? p.availability}
                      onChange={(e) => setChange(p.code, e.target.value)}
                      className="rounded-md border border-line bg-white px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {AVAILABILITY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && <p className="px-4 py-3 text-xs text-ink-soft">Showing 200 of {filtered.length}. Use the search box to filter.</p>}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analytics Dashboard
// ---------------------------------------------------------------------------

function AnalyticsAdmin() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJSON('/api/admin/analytics').then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-ink-soft">Failed to load analytics.</p>

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-bold">Search Analytics</h2>
        <p className="mt-0.5 text-sm text-ink-soft">Last 30 days of search activity.</p>
        {data.tableReady === false && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Analytics table not set up yet.</p>
            <p className="mt-1 text-xs">Run this in your Supabase SQL Editor:</p>
            <pre className="mt-2 text-xs bg-amber-100 rounded p-2 overflow-x-auto">{`CREATE TABLE IF NOT EXISTS search_logs (
  id bigserial PRIMARY KEY,
  query text NOT NULL DEFAULT '',
  result_count int NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'part',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_logs_created_at_idx ON search_logs (created_at DESC);`}</pre>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Searches Today', value: data.todaySearches },
          { label: 'Total Searches', value: data.totalSearches },
          { label: 'Unique Queries (30d)', value: data.topQueries?.length ?? 0 },
          { label: 'No-Result Queries', value: data.zeroResults?.length ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-2xl font-bold text-primary">{value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-ink-soft">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Top Searches */}
        <div>
          <h3 className="text-sm font-bold mb-3">Top Searches (30 days)</h3>
          {data.topQueries?.length === 0
            ? <p className="text-sm text-ink-soft">No searches yet. Data populates as users search.</p>
            : (
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-xs text-ink-soft">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">#</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Query</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Searches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.topQueries?.map((q: any, i: number) => (
                      <tr key={q.query} className="hover:bg-surface/60">
                        <td className="px-4 py-2.5 text-xs text-ink-soft">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono font-medium">{q.query}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold">{q.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {/* Zero-result Searches */}
        <div>
          <h3 className="text-sm font-bold mb-3">Searches with No Results <span className="text-xs font-normal text-ink-soft">(add these to your catalog)</span></h3>
          {data.zeroResults?.length === 0
            ? <p className="text-sm text-ink-soft text-emerald-600 font-medium">All searches are finding results.</p>
            : (
              <div className="overflow-hidden rounded-xl border border-red-100 bg-red-50/40">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 text-xs text-red-700">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Query</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Times Searched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {data.zeroResults?.map((q: any) => (
                      <tr key={q.query} className="hover:bg-red-50">
                        <td className="px-4 py-2.5 font-mono font-medium text-red-900">{q.query}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-red-700">{q.zeros}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
