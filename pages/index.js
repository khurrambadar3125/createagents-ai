import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const { data: { session } } = await supabase.auth.getSession()
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
