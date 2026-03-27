import '@/styles/globals.css'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { I18nProvider } from '@/lib/i18n'

export default function App({ Component, pageProps }) {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Capture the install prompt
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      // Show our custom banner after 5 seconds if not dismissed before
      const dismissed = localStorage.getItem('pwa_install_dismissed')
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 5000)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Track successful install
    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false)
      setInstallPrompt(null)
      localStorage.setItem('pwa_installed', '1')
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setInstallPrompt(null)
  }

  function dismissInstall() {
    setShowInstallBanner(false)
    localStorage.setItem('pwa_install_dismissed', '1')
  }

  return (
    <I18nProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
      </Head>
      <Component {...pageProps} />

      {/* Install App Banner */}
      {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-forest text-cream px-4 py-3 shadow-lg animate-slide-down safe-top">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-terracotta flex items-center justify-center text-white font-bold flex-shrink-0">
              C
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Install CreateAgent.ai</p>
              <p className="text-xs text-cream/60">Add to your home screen for faster access</p>
            </div>
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 whitespace-nowrap"
            >
              Install
            </button>
            <button
              onClick={dismissInstall}
              className="text-cream/40 hover:text-cream text-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </I18nProvider>
  )
}
