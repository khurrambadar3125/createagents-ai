import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { href: '/templates', label: 'Agent Library', icon: '🚀' },
  { href: '/build', label: 'Build Agent', icon: '✦' },
  { href: '/files', label: 'Files', icon: '◈' },
  { href: '/runs', label: 'Run History', icon: '▸' },
  { href: '/settings', label: 'Settings', icon: '◉' },
]

export default function Layout({ children, user, profile }) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="min-h-screen bg-cream font-sans flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-forest text-cream transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } flex flex-col`}
      >
        <div className="p-6 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-terracotta flex items-center justify-center text-white font-bold text-lg">
              C
            </div>
            <div>
              <div className="font-serif text-lg font-bold tracking-tight">CreateAgent</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-cream/50">.ai</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = router.pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-terracotta text-white font-medium'
                    : 'text-cream/70 hover:bg-white/10 hover:text-cream'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User pill */}
        {profile && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-terracotta/80 flex items-center justify-center text-sm font-medium">
                {(profile.full_name || profile.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {profile.full_name || 'User'}
                </div>
                <div className="text-[11px] text-cream/50 uppercase tracking-wider">
                  {profile.plan} plan
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-cream/40 hover:text-cream text-xs"
                title="Sign out"
              >
                ↗
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-forest"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-serif font-bold text-forest">CreateAgent.ai</span>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {typeof children === 'function' ? children({ showToast }) : children}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-forest text-cream'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
