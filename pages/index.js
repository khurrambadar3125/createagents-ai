import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const { data: { session } } = await supabase.auth.getSession()

      // Handle deploy intent from landing page
      const deploySlug = router.query.deploy
      if (deploySlug) {
        if (session) {
          // User is logged in — deploy the agent
          try {
            const res = await fetch('/api/agents/deploy-by-slug', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug: deploySlug, owner_id: session.user.id }),
            })
            const data = await res.json()
            if (res.ok && data.id) {
              router.replace(`/agent/${data.id}`)
              return
            }
          } catch {}
          router.replace('/dashboard')
        } else {
          // Store intent and redirect to auth
          if (typeof window !== 'undefined') {
            localStorage.setItem('deploy_intent', deploySlug)
          }
          router.replace('/auth')
        }
        return
      }

      router.replace(session ? '/dashboard' : '/auth')
    }
    redirect()
  }, [router])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center font-sans">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-terracotta border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-400">Loading CreateAgent.ai...</p>
      </div>
    </div>
  )
}
