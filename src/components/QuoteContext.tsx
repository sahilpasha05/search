import { createContext, useCallback, useContext, useState } from 'react'
import { X } from 'lucide-react'
import { QuoteForm } from './QuoteForm'

interface QuotePrefill { product?: string; partNumber?: string }
interface QuoteCtx { openQuote: (prefill?: QuotePrefill) => void }

const Ctx = createContext<QuoteCtx>({ openQuote: () => {} })
export const useQuote = () => useContext(Ctx)

export function QuoteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<QuotePrefill>({})

  const openQuote = useCallback((p?: QuotePrefill) => {
    setPrefill(p ?? {})
    setOpen(true)
  }, [])

  return (
    <Ctx.Provider value={{ openQuote }}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-pop sm:max-w-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Request a Quote</h2>
                <p className="mt-0.5 text-sm text-ink-soft">Our sales team responds within one business day.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-surface hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <QuoteForm prefillProduct={prefill.product} prefillPart={prefill.partNumber} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
