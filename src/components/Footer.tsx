import { Link } from 'react-router-dom'
import { Container } from './ui'
import { Logo } from './Header'
import { useMeta } from '../lib/api'

export function Footer() {
  const meta = useMeta()
  return (
    <footer className="mt-20 border-t border-line bg-surface pb-24 lg:pb-0">
      <Container className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
            Industrial filtration specialists. Search thousands of filters by OEM part number,
            size, specifications, or category — and get a quote fast.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide">Company</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            <li><Link className="hover:text-primary" to="/about">About Us</Link></li>
            <li><Link className="hover:text-primary" to="/contact">Contact</Link></li>
            <li><Link className="hover:text-primary" to="/quote">Request a Quote</Link></li>
            <li><Link className="hover:text-primary" to="/admin">Admin Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide">Popular Categories</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            {(meta?.categories ?? []).slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link className="hover:text-primary" to={`/products?category=${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide">Get in Touch</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            <li>sales@filtercore.example</li>
            <li>+91 98765 43210</li>
            <li>Mon–Sat, 9:00–18:00 IST</li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-line py-5 text-center text-xs text-ink-soft">
        © {new Date().getFullYear()} FilterCore Industrial Filtration. All rights reserved.
      </div>
    </footer>
  )
}
