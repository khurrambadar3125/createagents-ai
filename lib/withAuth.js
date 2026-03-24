import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabase'

export default function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      async function checkAuth() {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.replace('/auth')
          return
        }
        setUser(session.user)

        // Fetch or create profile
        let { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (!prof) {
          const { data: newProf } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || '',
              plan: 'free',
              runs_used: 0,
              runs_limit: 15,
            })
            .select()
            .single()
          prof = newProf
        }
        setProfile(prof)
        setLoading(false)
      }
      checkAuth()

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === 'SIGNED_OUT') router.replace('/auth')
        }
      )
      return () => subscription.unsubscribe()
    }, [router])

    if (loading) {
      return (
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-terracotta border-t-transparent rounded-full" />
        </div>
      )
    }

    return <Component {...props} user={user} profile={profile} />
  }
}
