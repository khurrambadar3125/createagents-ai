import { useState } from 'react'
import Layout from '@/components/Layout'
import withAuth from '@/lib/withAuth'
import { supabase } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/utils'

function SettingsPage({ user, profile }) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const plan = PLAN_LIMITS[profile?.plan || 'free']

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Layout user={user} profile={profile}>
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your profile and workspace</p>
        </div>

        {/* Profile */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-serif text-lg font-bold text-forest">Profile</h2>
          <div>
            <label className="block text-sm font-medium text-forest mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest mb-1.5">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-400 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && <span className="text-sm text-green-600">Saved!</span>}
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-serif text-lg font-bold text-forest">Plan & Usage</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-cream rounded-xl">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Plan</div>
              <div className="font-serif text-xl font-bold text-forest">{plan.label}</div>
              {plan.price > 0 && <div className="text-sm text-gray-400">${plan.price}/month</div>}
            </div>
            <div className="p-4 bg-cream rounded-xl">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Runs Used</div>
              <div className="font-serif text-xl font-bold text-forest">
                {profile?.runs_used || 0}
                <span className="text-sm text-gray-300 font-sans font-normal">
                  /{plan.runs === -1 ? '∞' : plan.runs}
                </span>
              </div>
            </div>
          </div>
          {plan.price === 0 && (
            <div className="p-4 bg-terracotta/5 border border-terracotta/10 rounded-xl">
              <p className="text-sm text-forest">
                <strong>Upgrade your plan</strong> to unlock more runs, agents, and features.
              </p>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl border border-red-100 p-6 space-y-4">
          <h2 className="font-serif text-lg font-bold text-red-600">Danger Zone</h2>
          <p className="text-sm text-gray-400">
            Signing out will end your current session. You can always sign back in.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/auth'
            }}
            className="px-5 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    </Layout>
  )
}

export default withAuth(SettingsPage)
