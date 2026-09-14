import { Link } from 'react-router-dom'
import { BadgeCheck, Factory, Globe2, Users } from 'lucide-react'
import { Container, btnAccent } from '../components/ui'

export function About() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">About FilterCore</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Filtration specialists trusted by plants, workshops and OEMs.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
            For over two decades we've supplied industrial filters across compressed air, hydraulics,
            dust collection, EDM and process industries. Our cross-reference database means you can
            bring us any part number — ours, an OEM's, or a competitor's — and we'll identify the
            right element.
          </p>
        </Container>
      </section>

      <Container className="py-14">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[
            [Factory, '20+ years', 'Serving Indian and export markets'],
            [BadgeCheck, 'ISO 9001', 'Certified quality management'],
            [Users, '1,800+', 'Active B2B customers'],
            [Globe2, '14 countries', 'Export footprint and growing'],
          ].map(([Icon, v, l]: any) => (
            <div key={l} className="rounded-2xl border border-line p-6 text-center shadow-card">
              <Icon className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-3 text-xl font-extrabold">{v}</p>
              <p className="mt-1 text-xs text-ink-soft">{l}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold">What we do</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              We manufacture and stock replacement elements for compressors, hydraulic systems,
              generators, dust collectors, wire-cut EDM machines and liquid process lines. Every
              element is dimension-checked against OEM specifications and media-matched for
              efficiency and service life.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Our catalogue is built around cross-references: one product record carries every OEM
              and aftermarket number it replaces, so procurement teams find the right part in
              seconds — not hours.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-bold">Why buyers choose us</h2>
            <ul className="mt-3 space-y-3 text-sm text-ink-soft">
              {[
                'Cross-reference identification from any part number, sample or drawing',
                'OEM-equivalent media grades with documented micron ratings',
                'Stock elements dispatched within 48 hours',
                'Custom sizes manufactured for legacy and imported machines',
                'Dedicated account support for annual rate contracts',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 rounded-2xl bg-ink px-6 py-10 text-center">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Have a filter to identify?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70">Send us the number stamped on it — our team will match it to the right element.</p>
          <Link to="/quote" className={btnAccent + ' mt-6 px-8'}>Request a Quote</Link>
        </div>
      </Container>
    </>
  )
}
