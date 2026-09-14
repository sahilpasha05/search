import { useSearchParams } from 'react-router-dom'
import { Clock3, ShieldCheck, Truck } from 'lucide-react'
import { QuoteForm } from '../components/QuoteForm'
import { Container } from '../components/ui'

export function QuotePage() {
  const [params] = useSearchParams()
  return (
    <Container className="py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Request a Quote</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft sm:text-base">
          Tell us what you need — a part number, a product from our catalogue, or even a
          competitor's reference. Our sales team responds within one business day.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            [Clock3, '24 hr response'],
            [ShieldCheck, 'Spec-verified parts'],
            [Truck, '48 hr dispatch'],
          ].map(([Icon, t]: any) => (
            <div key={t} className="flex items-center justify-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-xs font-semibold text-ink-soft">
              <Icon className="h-4 w-4 text-primary" />
              <span>{t}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-line p-6 shadow-card sm:p-8">
          <QuoteForm prefillProduct={params.get('product') ?? ''} prefillPart={params.get('part') ?? ''} />
        </div>
      </div>
    </Container>
  )
}
