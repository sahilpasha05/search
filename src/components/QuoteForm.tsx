import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { sendJSON } from '../lib/api'
import { btnAccent, inputCls, labelCls } from './ui'

export function QuoteForm({
  prefillProduct = '',
  prefillPart = '',
  onDone,
}: {
  prefillProduct?: string
  prefillPart?: string
  onDone?: () => void
}) {
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '',
    product: prefillProduct, part_number: prefillPart, quantity: '', message: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await sendJSON('/api/quotes', 'POST', form)
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="animate-fade-in rounded-xl bg-emerald-50 px-6 py-10 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h3 className="mt-4 text-lg font-bold text-ink">Quote request received</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          Thank you, {form.name.split(' ')[0]}. Our sales team will review your requirement and get
          back to you at <span className="font-medium text-ink">{form.email}</span> within one business day.
        </p>
        {onDone && (
          <button onClick={onDone} className="mt-6 rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-ink/90">
            Done
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className={labelCls}>Name *</label>
        <input required className={inputCls} value={form.name} onChange={set('name')} placeholder="Full name" />
      </div>
      <div>
        <label className={labelCls}>Company</label>
        <input className={inputCls} value={form.company} onChange={set('company')} placeholder="Company name" />
      </div>
      <div>
        <label className={labelCls}>Email *</label>
        <input required type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="you@company.com" />
      </div>
      <div>
        <label className={labelCls}>Phone</label>
        <input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+91 …" />
      </div>
      <div>
        <label className={labelCls}>Product</label>
        <input className={inputCls} value={form.product} onChange={set('product')} placeholder="Product name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Part Number</label>
          <input className={inputCls} value={form.part_number} onChange={set('part_number')} placeholder="e.g. C-14200" />
        </div>
        <div>
          <label className={labelCls}>Quantity</label>
          <input className={inputCls} value={form.quantity} onChange={set('quantity')} placeholder="e.g. 50" />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Message</label>
        <textarea rows={3} className={inputCls} value={form.message} onChange={set('message')} placeholder="Application details, target price, delivery location…" />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button disabled={sending} className={`${btnAccent} w-full`}>
          {sending ? 'Sending…' : 'Submit Quote Request'}
        </button>
      </div>
    </form>
  )
}
