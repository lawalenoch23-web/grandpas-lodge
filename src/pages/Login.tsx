import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Role = 'manager' | 'receptionist' | 'housekeeping'

const ROLES: { id: Role; label: string; icon: string; desc: string }[] = [
  { id: 'manager', label: 'Manager', icon: '👔', desc: 'Full access & reports' },
  { id: 'receptionist', label: 'Receptionist', icon: '🗝️', desc: 'Check-in & bookings' },
  { id: 'housekeeping', label: 'Housekeeping', icon: '🧹', desc: 'Room cleaning tasks' },
]

export default function Login() {
  const navigate = useNavigate()
  const [role, setRole] = useState<Role | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!role || !password) return
    setLoading(true)
    setError('')

    try {
      const { data, error: dbErr } = await supabase
        .from('hotel_settings')
        .select('manager_password, receptionist_password, housekeeping_password')
        .single()

      if (dbErr) throw dbErr

      const pwMap: Record<Role, string> = {
        manager: data.manager_password,
        receptionist: data.receptionist_password,
        housekeeping: data.housekeeping_password,
      }

      const masterKey = import.meta.env.VITE_MASTER_RECOVERY_KEY
      const isValid = password === pwMap[role] || (role === 'manager' && password === masterKey)

      if (!isValid) {
        setError('Incorrect password. Please try again.')
        setLoading(false)
        return
      }

      const sessionData = { role, time: Date.now() }
      localStorage.setItem(`lodge_${role}_session`, JSON.stringify(sessionData))

      const routes: Record<Role, string> = {
        manager: '/manager',
        receptionist: '/receptionist',
        housekeeping: '/housekeeping',
      }
      navigate(routes[role])
    } catch (e) {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-lodge flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="text-gold text-xs font-mono tracking-[0.3em] uppercase mb-3">Staff Portal</p>
          <h1 className="font-display text-5xl text-white italic mb-1">Grandpa's</h1>
          <h2 className="font-display text-3xl text-gold tracking-widest uppercase">Lodge</h2>
          <div className="gold-divider mt-6 max-w-32 mx-auto" />
        </div>

        <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-8">
          {/* Step 1 — Role selection */}
          {!role ? (
            <div>
              <p className="text-xs font-mono text-gold/70 uppercase tracking-widest mb-5">Select your role</p>
              <div className="space-y-3">
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-lodge-border
                      hover:border-gold/50 hover:bg-gold/5 transition-all duration-200 text-left group"
                  >
                    <span className="text-2xl">{r.icon}</span>
                    <div>
                      <p className="font-semibold text-white group-hover:text-gold transition-colors">{r.label}</p>
                      <p className="text-xs text-white/40">{r.desc}</p>
                    </div>
                    <span className="ml-auto text-white/20 group-hover:text-gold transition-colors">→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Back */}
              <button
                onClick={() => { setRole(null); setPassword(''); setError('') }}
                className="text-xs text-white/40 hover:text-gold transition-colors mb-6 flex items-center gap-1"
              >
                ← Back
              </button>

              <p className="text-xs font-mono text-gold/70 uppercase tracking-widest mb-2">
                {ROLES.find(r => r.id === role)?.icon} {ROLES.find(r => r.id === role)?.label}
              </p>
              <p className="text-sm text-white/50 mb-6">Enter your password to continue</p>

              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                autoFocus
                className="w-full px-4 py-3.5 bg-lodge-card border border-lodge-border rounded-xl
                  text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50
                  font-mono text-sm transition-all mb-4"
              />

              {error && (
                <p className="text-red-400 text-xs mb-4 font-medium">{error}</p>
              )}

              <button
                onClick={handleLogin}
                disabled={loading || !password}
                className="w-full py-3.5 bg-gold hover:bg-gold-light disabled:bg-lodge-border
                  disabled:text-white/30 text-lodge font-semibold rounded-xl transition-all
                  text-sm tracking-wide disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Enter Portal'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-6 font-mono">
          Grandpa's Lodge Management System
        </p>
      </div>
    </div>
  )
}
