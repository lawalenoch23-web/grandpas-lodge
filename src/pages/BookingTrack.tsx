import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Booking } from '../lib/types'
import { Search, CheckCircle, Clock, X, ArrowLeft, MessageCircle } from 'lucide-react'

function fmt(n: number) { return `₦${n.toLocaleString()}` }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Booking Received', icon: '📋' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'checked_in', label: 'Checked In', icon: '🗝️' },
  { key: 'checked_out', label: 'Checked Out', icon: '👋' },
]

export default function BookingTrack() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState(bookingId !== '0' ? bookingId || '' : '')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [hotelName, setHotelName] = useState("Grandpa's Lodge")
  const [whatsapp, setWhatsapp] = useState('')

  useEffect(() => {
    supabase.from('hotel_settings').select('hotel_name, whatsapp_number').single().then(({ data }) => {
      if (data) { setHotelName(data.hotel_name); setWhatsapp(data.whatsapp_number || '') }
    })
    if (bookingId && bookingId !== '0') searchBooking(bookingId)
  }, [])

  const searchBooking = async (id?: string) => {
    const searchId = id || query.trim()
    if (!searchId) return
    setLoading(true)
    setNotFound(false)
    setBooking(null)

    const { data } = await supabase
      .from('bookings')
      .select('*, room:rooms(*)')
      .eq('id', parseInt(searchId))
      .single()

    if (data) setBooking(data as any)
    else setNotFound(true)
    setLoading(false)
  }

  const currentStepIndex = booking
    ? STATUS_STEPS.findIndex(s => s.key === booking.status)
    : -1

  const balance = booking ? booking.total_price - booking.amount_paid : 0

  return (
    <div className="min-h-screen bg-lodge px-4 py-8">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/30 hover:text-gold transition-colors text-sm mx-auto mb-6">
            <ArrowLeft size={14} /> Back to {hotelName}
          </button>
          <p className="font-display text-4xl italic text-white mb-1">Track Booking</p>
          <p className="text-white/40 text-sm">Enter your booking reference number</p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input
              type="number"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchBooking()}
              placeholder="Enter booking ID (e.g. 42)"
              className="w-full bg-lodge-surface border border-lodge-border rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/40 transition-all"
            />
          </div>
          <button onClick={() => searchBooking()}
            className="px-5 py-3.5 bg-gold hover:bg-gold-light text-lodge font-semibold rounded-xl transition-all text-sm">
            Search
          </button>
        </div>

        {loading && (
          <div className="text-center py-12 text-white/30">
            <p className="animate-pulse font-display text-xl italic">Searching...</p>
          </div>
        )}

        {notFound && (
          <div className="text-center py-12 text-white/20">
            <X size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-display text-2xl italic mb-2">Booking not found</p>
            <p className="text-sm">Please check your booking reference number</p>
          </div>
        )}

        {booking && (
          <div className="space-y-4 animate-fade-up">
            {/* Status steps */}
            <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-6">
              <p className="text-xs font-mono text-gold/60 uppercase tracking-widest mb-5">Booking Status</p>
              <div className="relative">
                {/* Progress line */}
                <div className="absolute left-5 top-5 bottom-5 w-px bg-lodge-border" />
                <div
                  className="absolute left-5 top-5 w-px bg-gold transition-all duration-500"
                  style={{ height: `${Math.max(0, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100)}%` }}
                />

                <div className="space-y-6">
                  {STATUS_STEPS.map((s, i) => {
                    const isDone = i <= currentStepIndex
                    const isCurrent = i === currentStepIndex
                    return (
                      <div key={s.key} className="flex items-center gap-4 relative">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-all ${
                          isDone ? 'border-gold bg-gold/10' : 'border-lodge-border bg-lodge'
                        }`}>
                          <span className={`text-sm ${isDone ? '' : 'opacity-20'}`}>{s.icon}</span>
                        </div>
                        <div>
                          <p className={`font-medium text-sm ${isDone ? 'text-white' : 'text-white/20'}`}>{s.label}</p>
                          {isCurrent && <p className="text-gold text-xs font-mono">Current status</p>}
                        </div>
                        {isCurrent && <div className="ml-auto w-2 h-2 bg-gold rounded-full animate-pulse" />}
                      </div>
                    )
                  })}

                  {(booking.status === 'cancelled' || booking.status === 'no_show') && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border-2 border-red-500/30 bg-red-500/10 flex items-center justify-center flex-shrink-0 z-10">
                        <X size={16} className="text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-red-400 capitalize">{booking.status.replace('_', ' ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Booking details */}
            <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-5">
              <p className="text-xs font-mono text-gold/60 uppercase tracking-widest mb-4">Booking Details</p>
              <div className="space-y-3">
                {[
                  { label: 'Reference', val: `#${booking.id}` },
                  { label: 'Guest', val: booking.customer_name },
                  { label: 'Phone', val: booking.phone },
                  { label: 'Room', val: (booking as any).room?.name },
                  { label: 'Type', val: (booking as any).room?.type },
                  { label: 'Check In', val: fmtDate(booking.check_in) },
                  { label: 'Check Out', val: fmtDate(booking.check_out) },
                  { label: 'Nights', val: `${booking.nights} night${booking.nights !== 1 ? 's' : ''}` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-white/40">{row.label}</span>
                    <span className="text-white font-medium capitalize">{row.val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment */}
            <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-5">
              <p className="text-xs font-mono text-gold/60 uppercase tracking-widest mb-4">Payment</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Total</span>
                  <span className="text-white font-semibold">{fmt(booking.total_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Amount Paid</span>
                  <span className="text-emerald-400 font-semibold">{fmt(booking.amount_paid)}</span>
                </div>
                {balance > 0 && (
                  <div className="flex justify-between pt-2 border-t border-lodge-border">
                    <span className="text-white/40">Balance Due</span>
                    <span className="text-red-400 font-bold">{fmt(balance)}</span>
                  </div>
                )}
                {balance === 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-lodge-border text-emerald-400">
                    <CheckCircle size={14} />
                    <span className="text-sm font-medium">Fully Paid</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello, I have a question about my booking #${booking.id}`)}`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium transition-all">
                <MessageCircle size={15} /> Contact Hotel via WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
