import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { getJSON, useDebounced } from '../lib/api'
import { Container, EmptyState, Spinner, inputCls } from '../components/ui'
import { useQuote } from '../components/QuoteContext'

export interface GasketRow {
  id: number
  model: string
  sr_no: number | null
  part_no: string
  die_no: string
  description: string
  ccn: string
  nos: number
  rate: number | null
  rate_15: number | null
  image: string
}

export interface GasketData {
  count: number
  fuzzy?: boolean
  models: { model: string; items: GasketRow[] }[]
}

const inr = (v: number | null) => (v == null ? '—' : `₹ ${v}`)

export function Gaskets() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [data, setData] = useState<GasketData | null>(null)
  const [loading, setLoading] = useState(true)
  const { openQuote } = useQuote()

  useEffect(() => {
    setLoading(true)
    getJSON<GasketData>(`/api/gaskets?q=${encodeURIComponent(dq)}`)
      .then(setData)
      .catch(() => setData({ count: 0, models: [] }))
      .finally(() => setLoading(false))
  }, [dq])

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Gaskets &amp; Dies</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
        Compressor gasket catalogue, model-wise. Every gasket carries an{' '}
        <span className="font-semibold text-ink">Si die code</span> and a{' '}
        <span className="font-semibold text-ink">C.C.N number</span> — search by part number, die
        code, CCN or model.
      </p>

      <div className="relative mt-6 max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-soft/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search part no, Si die code, CCN, or model… e.g. W6868, Si 04, 30295034"
          className={`${inputCls} py-3 pl-10`}
        />
      </div>

      {loading && <Spinner />}
      {!loading && data?.fuzzy && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-fade-in">
          No exact match for <span className="font-mono font-semibold">“{dq}”</span> — showing{' '}
          <span className="font-semibold">close matches</span> (possible typo). Please verify the part
          number, die code or CCN before quoting.
        </div>
      )}
      {!loading && data && data.count === 0 && (
        <div className="mt-8"><EmptyState query={dq || undefined} /></div>
      )}

      {!loading && data && data.models.map(({ model, items }) => (
        <section key={model} className="mt-8 animate-fade-in">
          <div className="flex items-center justify-between rounded-t-2xl bg-primary px-4 py-2.5">
            <h2 className="text-base font-bold text-white">Model {model}</h2>
            <span className="text-xs font-medium text-white/80">
              {items.reduce((s, i) => s + (i.nos || 1), 0)} Nos per set
            </span>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-line rounded-b-2xl border border-t-0 border-line bg-white">
            {items.map((g) => (
              <div key={g.id} className="flex gap-3 p-3">
                <img src={g.image || '/img/cat-gasket.svg'} alt={g.part_no} className="h-14 w-14 shrink-0 rounded-md border border-line bg-surface object-cover" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-ink">{g.part_no}</span>
                    {g.die_no && <span className="shrink-0 rounded bg-primary-light px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{g.die_no}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{g.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
                    {g.ccn && <span>CCN: <span className="font-mono text-ink">{g.ccn}</span></span>}
                    <span>Nos: <span className="font-medium text-ink">{g.nos}</span></span>
                    {g.rate != null && <span className="font-semibold text-ink">{inr(g.rate)}</span>}
                  </div>
                  <button
                    onClick={() => openQuote({ product: `Gasket ${g.part_no} — ${g.description} (Model ${g.model}, Die ${g.die_no})`, partNumber: g.ccn })}
                    className="mt-2 rounded-md bg-accent px-3 py-1 text-[11px] font-semibold text-white"
                  >
                    Quote
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-b-2xl border border-t-0 border-line">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-3 py-2.5">Sr</th>
                  <th className="px-3 py-2.5">Die Photo</th>
                  <th className="px-3 py-2.5">Part No</th>
                  <th className="px-3 py-2.5">Die No</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5">C.C.N</th>
                  <th className="px-3 py-2.5 text-center">Nos</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">1.5 mm</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.id} className="border-t border-line hover:bg-surface/50">
                    <td className="px-3 py-2.5 text-ink-soft">{g.sr_no ?? '—'}</td>
                    <td className="px-3 py-2">
                      <img src={g.image || '/img/cat-gasket.svg'} alt={g.part_no} className="h-10 w-14 rounded-md border border-line bg-surface object-cover" loading="lazy" />
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold">{g.part_no}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md bg-primary-light px-2 py-0.5 font-mono text-xs font-bold text-primary">{g.die_no || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">{g.description}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{g.ccn}</td>
                    <td className="px-3 py-2.5 text-center">{g.nos}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{inr(g.rate)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{inr(g.rate_15)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => openQuote({ product: `Gasket ${g.part_no} — ${g.description} (Model ${g.model}, Die ${g.die_no})`, partNumber: g.ccn })}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark"
                      >
                        Quote
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </Container>
  )
}
