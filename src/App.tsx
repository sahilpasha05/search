import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Header } from './components/Header'
import { BottomNav } from './components/BottomNav'
import { Home } from './pages/Home'
import { SearchPage } from './pages/SearchPage'
import { Products } from './pages/Products'
import { ProductDetails } from './pages/ProductDetails'
import { Categories } from './pages/Categories'
import { Gaskets } from './pages/Gaskets'
import { DimensionSearch } from './pages/DimensionSearch'
import { Admin } from './pages/Admin'
import { Spinner } from './components/ui'

function ScrollToTop() {
  const { pathname, search } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname, search])
  return null
}

function AppShell() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Spinner label="Loading…" />
      </div>
    )
  }

  return (
    <>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col bg-surface">
        <Header />
        <main className="flex-1 pb-28">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetails />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/gaskets" element={<Gaskets />} />
            <Route path="/size-search" element={<DimensionSearch />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<SearchPage />} />
          </Routes>
        </main>
        <BottomNav />
        <footer className="border-t border-line bg-white py-3 text-center text-xs text-ink-soft">
          FilterCore Internal Catalog — Shree Sukhram Industries
        </footer>
      </div>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
