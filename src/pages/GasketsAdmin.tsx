import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Search, Trash2, Upload, X, CheckCircle2, Download } from 'lucide-react'
import { getJSON, sendJSON, useDebounced } from '../lib/api'
import { parseCSV } from '../lib/csv'
import { Spinner, btnGhost, btnPrimary, inputCls, labelCls } from '../components/ui'
import type { GasketData, GasketRow } from './Gaskets'

export function GasketsAdmin() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [data, setData] = useState<GasketData | null>(null)
  const [editing, setEditing] = useState<GasketRow | 'new' | null>(null)

  const load = useCallback(() => {
    getJSON<GasketData>(`/api/gaskets?q=${encodeURIComponent(dq)}`).then(setData)
  }, [dq])
  useEffect(load, [load])

  const del = async (g: GasketRow) => {
    if (!confirm(`Delete gasket ${g.part_no} (Model ${g.model})?`)) return
    await sendJSON(`/api/gaskets/${g.id}`, 'DELETE', {})
    load()
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/60" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search part no, die no, CCN…" className={`${inputCls} pl-10`} />
        </div>
        <div className="flex gap-2">
          <a href="/api/export/gaskets" className={btnGhost + ' inline-flex items-center gap-2'}>
            <Download className="h-4 w-4" /> Export Excel
          </a>
          <button onClick={() => setEditing('new')} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Add Gasket
          </button>
        </div>
      </div>

      {!data ? <Spinner /> : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-3">Model</th>
                <th className="px-3 py-3">Photo</th>
                <th className="px-3 py-3">Part No</th>
                <th className="px-3 py-3">Die No</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">C.C.N</th>
                <th className="px-3 py-3 text-center">Nos</th>
                <th className="px-3 py-3 text-right">Rate</th>
                <th className="px-3 py-3 text-right">1.5 mm</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.models.flatMap(({ items }) => items).map((g) => (
                <tr key={g.id} className="border-t border-line hover:bg-surface/50">
                  <td className="px-3 py-2.5 font-semibold">{g.model}</td>
                  <td className="px-3 py-2">
                    <img src={g.image || '/img/cat-gasket.svg'} alt="" className="h-9 w-12 rounded-md border border-line object-cover" />
                  </td>
                  <td className="px-3 py-2.5 font-mono">{g.part_no}</td>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-primary">{g.die_no}</td>
                  <td className="px-3 py-2.5">{g.description}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{g.ccn}</td>
                  <td className="px-3 py-2.5 text-center">{g.nos}</td>
                  <td className="px-3 py-2.5 text-right">{g.rate ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right">{g.rate_15 ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(g)} aria-label="Edit" className="rounded-lg p-2 text-ink-soft hover:bg-primary-light hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => del(g)} aria-label="Delete" className="rounded-lg p-2 text-ink-soft hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.count === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-soft">No gaskets found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <GasketImport onDone={load} />

      {editing && (
        <GasketEditor
          gasket={editing === 'new' ? null : editing}
          onClose={(saved) => { setEditing(null); if (saved) load() }}
        />
      )}
    </div>
  )
}

function GasketEditor({ gasket, onClose }: { gasket: GasketRow | null; onClose: (saved: boolean) => void }) {
  const [f, setF] = useState({
    model: gasket?.model ?? '',
    sr_no: gasket?.sr_no?.toString() ?? '',
    part_no: gasket?.part_no ?? '',
    die_no: gasket?.die_no ?? '',
    description: gasket?.description ?? '',
    ccn: gasket?.ccn ?? '',
    nos: gasket?.nos?.toString() ?? '1',
    rate: gasket?.rate?.toString() ?? '',
    rate_15: gasket?.rate_15?.toString() ?? '',
    image: gasket?.image ?? '/img/cat-gasket.svg',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }))
  const num = (s: string) => (s === '' ? null : Number(s))

  const uploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setF((v) => ({ ...v, image: reader.result as string }))
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setSaving(true); setError('')
    const body = { ...f, sr_no: num(f.sr_no), nos: num(f.nos) ?? 1, rate: num(f.rate), rate_15: num(f.rate_15) }
    try {
      if (gasket) await sendJSON(`/api/gaskets/${gasket.id}`, 'PUT', body)
      else await sendJSON('/api/gaskets', 'POST', body)
      onClose(true)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center animate-fade-in" onClick={() => onClose(false)}>
      <div className="animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-pop sm:max-w-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{gasket ? `Edit — ${gasket.part_no}` : 'Add Gasket'}</h2>
          <button onClick={() => onClose(false)} aria-label="Close" className="rounded-lg p-1.5 text-ink-soft hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div><label className={labelCls}>Model *</label><input className={inputCls} value={f.model} onChange={set('model')} placeholder="e.g. 231" /></div>
          <div><label className={labelCls}>Sr No</label><input type="number" className={inputCls} value={f.sr_no} onChange={set('sr_no')} /></div>
          <div><label className={labelCls}>Part No *</label><input className={inputCls} value={f.part_no} onChange={set('part_no')} placeholder="e.g. W 11300" /></div>
          <div><label className={labelCls}>Die No (Si)</label><input className={inputCls} value={f.die_no} onChange={set('die_no')} placeholder="e.g. Si 01" /></div>
          <div className="col-span-2"><label className={labelCls}>Description</label><input className={inputCls} value={f.description} onChange={set('description')} /></div>
          <div><label className={labelCls}>C.C.N</label><input className={inputCls} value={f.ccn} onChange={set('ccn')} /></div>
          <div><label className={labelCls}>Nos</label><input type="number" className={inputCls} value={f.nos} onChange={set('nos')} /></div>
          <div><label className={labelCls}>Rate (₹)</label><input type="number" className={inputCls} value={f.rate} onChange={set('rate')} /></div>
          <div><label className={labelCls}>1.5 mm (₹)</label><input type="number" className={inputCls} value={f.rate_15} onChange={set('rate_15')} /></div>
          <div className="col-span-2 sm:col-span-3">
            <label className={labelCls}>Die Photo</label>
            <div className="flex items-center gap-3">
              <img src={f.image} alt="" className="h-14 w-18 rounded-lg border border-line object-cover" />
              <label className={btnGhost + ' cursor-pointer px-4 py-2 text-xs'}>
                <Upload className="h-3.5 w-3.5" /> Upload Photo
                <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
              </label>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => onClose(false)} className={btnGhost}>Cancel</button>
          <button onClick={save} disabled={saving || !f.model || !f.part_no} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save Gasket'}
          </button>
        </div>
      </div>
    </div>
  )
}

function GasketImport({ onDone }: { onDone: () => void }) {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const guess = (headers: string[], ...needles: string[]) =>
    headers.find((h) => needles.some((n) => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(n))) ?? ''

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setResult(null); setBusy(true)
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      if (parsed.length < 2) throw new Error('The file needs a header row plus at least one data row.')
      const headers = parsed[0].map((h) => h.trim())
      const rows = parsed.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])))
      const mapping = {
        model: guess(headers, 'model'),
        sr_no: guess(headers, 'srno', 'sr'),
        part_no: guess(headers, 'partno', 'part'),
        die_no: guess(headers, 'dieno', 'die', 'si'),
        description: guess(headers, 'description', 'discription', 'desc'),
        ccn: guess(headers, 'ccn'),
        nos: guess(headers, 'nos', 'qty'),
        rate: guess(headers, 'rate'),
        rate_15: guess(headers, '15mm', '15'),
      }
      if (!mapping.model || !mapping.part_no) throw new Error('Could not find "Model" and "Part no" columns in the file.')
      const r = await sendJSON<any>('/api/gaskets/import', 'POST', { rows, mapping })
      setResult(r)
      onDone()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Import Gasket Sheet (CSV)</h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Columns: Model, Sr no, Part no, Die no, Description, C.C.N, Nos, Rate, 1.5 mm — mapped automatically.
          </p>
        </div>
        <label className={btnPrimary + ' cursor-pointer'}>
          <Upload className="h-4 w-4" /> {busy ? 'Importing…' : 'Choose CSV'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      </div>
      {result && (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Imported {result.added} rows ({result.skipped} skipped as duplicates/incomplete).
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
