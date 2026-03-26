import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'
import HelpChat from './HelpChat'

export default function Layout({ children, user, profile }) {
  const router = useRouter()
  const { t, locale, setLocale, isRtl, languages } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const NAV_ITEMS = [
    { href: '/dashboard', label: 'Home', icon: '🏠' },
    { href: '/templates', label: t('nav_library'), icon: '🚀', badge: '96' },
    { href: '/build', label: t('nav_build'), icon: '✦' },
    { href: '/files', label: t('nav_files'), icon: '◈' },
    { href: '/runs', label: t('nav_runs'), icon: '▸' },
    { href: '/pricing', label: t('nav_pricing'), icon: '💳' },
    { href: '/settings', label: t('nav_settings'), icon: '◉' },
  ]

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className={`min-h-dvh bg-cream font-sans flex ${isRtl ? 'flex-row-reverse' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-50 w-64 bg-forest text-cream transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : `${isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}`
        } flex flex-col`}
      >
        <div className="p-6 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-terracotta flex items-center justify-center text-white font-bold text-lg">C</div>
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
                  active ? 'bg-terracotta text-white font-medium' : 'text-cream/70 hover:bg-white/10 hover:text-cream'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${active ? 'bg-white/20 text-white' : 'bg-terracotta/20 text-terracotta'}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Language Switcher */}
        <div className="px-4 pb-2 relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-cream/60 hover:bg-white/10 hover:text-cream transition-all"
          >
            <span className="text-base">🌐</span>
            <span className="flex-1 text-left">{languages.find((l) => l.code === locale)?.name || 'English'}</span>
            <span className="text-xs">{langOpen ? '▾' : '▸'}</span>
          </button>
          {langOpen && (
            <div className="absolute bottom-12 left-4 right-4 bg-forest border border-white/10 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { setLocale(lang.code); setLangOpen(false) }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${
                    locale === lang.code ? 'text-terracotta font-medium' : 'text-cream/70'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User pill */}
        {profile && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-terracotta/80 flex items-center justify-center text-sm font-medium">
                {(profile.full_name || profile.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{profile.full_name || 'User'}</div>
                <div className="text-[11px] text-cream/50 uppercase tracking-wider">{profile.plan} {t('dash_plan').toLowerCase()}</div>
              </div>
              <button onClick={handleSignOut} className="text-cream/40 hover:text-cream text-xs" title={t('sign_out')}>↗</button>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="w-8 h-8 flex items-center justify-center text-forest">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-serif font-bold text-forest">CreateAgent.ai</span>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {typeof children === 'function' ? children({ showToast, t }) : children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-100 bg-white px-4 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-terracotta flex items-center justify-center text-white font-bold text-[10px]">C</div>
              <span className="font-medium text-forest">CreateAgent.ai</span>
              <span>— Describe it. We build it. You deploy it.</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://createagents.ai" className="hover:text-forest transition-colors">Home</a>
              <a href="/templates" className="hover:text-forest transition-colors">Agent Library</a>
              <a href="/pricing" className="hover:text-forest transition-colors">Pricing</a>
              <a href="mailto:hello@createagents.ai" className="hover:text-forest transition-colors">Contact</a>
            </div>
            <div className="text-gray-300">
              &copy; {new Date().getFullYear()} CreateAgent.ai. All rights reserved.
            </div>
          </div>
        </footer>
      </div>

      {/* Help chatbot — appears on every page */}
      <HelpChat user={user} />

      {toast && (
        <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-forest text-cream'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
