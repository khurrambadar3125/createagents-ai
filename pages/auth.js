import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleEmailAuth(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (signUpError) {
        setError(signUpError.message)
      } else {
        setMessage('Check your email for a confirmation link.')
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message)
      } else {
        // Check for deploy intent from landing page
        const deployIntent = typeof window !== 'undefined' && localStorage.getItem('deploy_intent')
        if (deployIntent) {
          localStorage.removeItem('deploy_intent')
          router.push(`/?deploy=${deployIntent}`)
        } else {
          router.push('/dashboard')
        }
      }
    }
    setLoading(false)
  }

  async function handleGoogleAuth() {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (oauthError) setError(oauthError.message)
  }

  return (
    <div className="min-h-screen bg-cream font-sans flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-forest text-cream flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-lg bg-terracotta flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <span className="font-serif text-2xl font-bold">CreateAgent.ai</span>
          </div>
          <h1 className="font-serif text-5xl font-bold leading-tight mb-6">
            Build AI agents<br />
            with words,<br />
            not code.
          </h1>
          <p className="text-cream/60 text-lg max-w-md leading-relaxed">
            Describe the agent you need. We architect, configure, and deploy it.
            From idea to production in under 3 minutes.
          </p>
        </div>
        <div className="flex items-center gap-8 text-sm text-cream/40">
          <span>80+ agents</span>
          <span>16 industries</span>
          <span>500+ integrations</span>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-lg bg-terracotta flex items-center justify-center text-white font-bold">
              C
            </div>
            <span className="font-serif text-xl font-bold text-forest">CreateAgent.ai</span>
          </div>

          <h2 className="font-serif text-3xl font-bold text-forest mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            {mode === 'signin'
              ? 'Sign in to continue building agents'
              : 'Start building AI agents in minutes'}
          </p>

          {/* Google button */}
          <button
            onClick={handleGoogleAuth}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-forest hover:bg-gray-50 transition-colors mb-6"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400">
              <span className="bg-cream px-4">or</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-forest mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-forest mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-forest mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm"
              />
            </div>

            {error && <div className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-xl">{error}</div>}
            {message && <div className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-xl">{message}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-terracotta text-white rounded-xl font-medium text-sm hover:bg-terracotta/90 disabled:opacity-50 transition-all"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            {mode === 'signin' ? (
              <>
                Don&apos;t have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(null) }} className="text-terracotta font-medium hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => { setMode('signin'); setError(null) }} className="text-terracotta font-medium hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
