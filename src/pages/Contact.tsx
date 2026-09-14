import { useState } from 'react'
import { Mail, MapPin, Phone, CheckCircle2 } from 'lucide-react'
import { sendJSON } from '../lib/api'
import { Container, btnPrimary, inputCls, labelCls } from '../components/ui'

export function Contact() {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await sendJSON('/api/quotes', 'POST', { ...form, product: 'General Enquiry' })
      setSent(true)
    } catch (err: any) { setError(err.message) } finally { setSending(false) }
  }

  return (
    <Container className="py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Contact Us</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-soft sm:text-base">
        Questions about a product, fitment, bulk pricing or exports — our team is here to help.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-line p-6 shadow-card sm:p-8">
          {sent ? (
            <div className="animate-fade-in py-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h3 className="mt-4 text-lg font-bold">Message received</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
                Thanks {form.name.split(' ')[0]} — we'll get back to you at {form.email} within one business day.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Name *</label>
                <input required className={inputCls} value={form.name} onChange={set('name')} />
              </div>
              <div>
                <label className={labelCls}>Company</label>
                <input className={inputCls} value={form.company} onChange={set('company')} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input required type="email" className={inputCls} value={form.email} onChange={set('email')} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={form.phone} onChange={set('phone')} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Message *</label>
                <textarea required rows={5} className={inputCls} value={form.message} onChange={set('message')} placeholder="Tell us what you need — part numbers, machine models, quantities…" />
              </div>
              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
              <div className="sm:col-span-2">
                <button disabled={sending} className={btnPrimary + ' w-full sm:w-auto sm:px-10'}>
                  {sending ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="space-y-4">
          {[
            [Phone, 'Phone', '+91 98765 43210', 'Mon–Sat, 9:00–18:00 IST'],
            [Mail, 'Email', 'sales@filtercore.example', 'We reply within one business day'],
            [MapPin, 'Works & Warehouse', 'Plot 42, Industrial Area Phase II', 'Bengaluru 560058, India'],
          ].map(([Icon, t, a, b]: any) => (
            <div key={t} className="flex gap-4 rounded-2xl border border-line p-5 shadow-card">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light">
                <Icon className="h-5 w-5 text-primary" />
              </span>
              <div>
                <p className="font-bold">{t}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{a}</p>
                <p className="text-sm text-ink-soft">{b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}
