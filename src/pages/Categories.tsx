import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useMeta, type Category } from '../lib/api'
import { Container, Spinner } from '../components/ui'

export function CategoryCard({ category: c }: { category: Category }) {
  return (
    <Link
      to={`/products?category=${c.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop"
    >
      <div className="bg-surface">
        <img src={c.image} alt={c.name} className="aspect-[16/9] w-full object-cover" loading="lazy" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold leading-snug transition-colors group-hover:text-primary">{c.name}</h3>
          <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary">
            {c.product_count}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">{c.description}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          View Products
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

export function Categories() {
  const meta = useMeta()
  return (
    <Container className="py-10">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Product Categories</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft sm:text-base">
          Every filtration family we stock — from wound polypropylene cartridges to compressor
          air/oil separators. Open a category to see its products, or use search if you have a
          part number.
        </p>
      </div>
      {!meta ? (
        <Spinner />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
          {meta.categories.map((c) => <CategoryCard key={c.id} category={c} />)}
        </div>
      )}
    </Container>
  )
}
