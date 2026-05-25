import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Room, HotelSettings } from '../lib/types'
import {
  BedDouble, Wifi, Wind, Tv, Coffee, Car, Dumbbell,
  Bath, Star, MapPin, Phone, MessageCircle, ChevronRight,
  X, CheckCircle, Calendar, Users, ArrowRight, Search
} from 'lucide-react'

function fmt(n: number) { return `₦${n.toLocaleString()}` }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}
function nightsBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}
function today() { return new Date().toISOString().split('T')[0] }
function addDays(date: string, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  'WiFi': <Wifi size={13} />, 'AC': <Wind size={13} />, 'TV': <Tv size={13} />,
  'Coffee': <Coffee size={13} />, 'Parking': <Car size={13} />, 'Gym': <Dumbbell size={13} />,
  'Bathroom': <Bath size={13} />, 'Mini Fridge': <Coffee size={13} />,
}

const TYPE_ORDER = ['standard', 'deluxe', 'suite', 'executive', 'presidential']
const ROOM_IMAGES: Record<string, string> = {
  standard: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
  deluxe: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',
  suite: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
  executive: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',
  presidential: 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=800&q=80',
}

type Step = 'browse' | 'booking' | 'confirmed'

export default function Home() {
  const [settings, setSettings] = useState<HotelSettings | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('browse')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [bookingRef, setBookingRef] = useState<number | null>(null)

  // Search
  const [checkIn, setCheckIn] = useState(today())
  const [checkOut, setCheckOut] = useState(addDays(today(), 1))
  const [guests, setGuests] = useState(1)
  const [showSearch, setShowSearch] = useState(false)

  // Booking form
  const [form, setForm] = useState({
    customer_name: '', phone: '', email: '',
    id_type: '', id_number: '', special_requests: '',
    payment_method: 'transfer', amount_paid: '0',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Announcement
  const [showAnnouncement, setShowAnnouncement] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [roomsRes, settingsRes] = await Promise.all([
      supabase.from('rooms').select('*').eq('is_active', true).order('type'),
      supabase.from('hotel_settings').select('*').single(),
    ])
    if (roomsRes.data) setRooms(roomsRes.data)
    if (settingsRes.data) setSettings(settingsRes.data)
    setLoading(false)
  }

  // Filter available rooms
  const availableRooms = rooms.filter(r =>
    r.status === 'available' && r.max_guests >= guests
  ).sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))

  const nights = nightsBetween(checkIn, checkOut)

  // ── Book room ──────────────────────────────────────────
  const handleBook = async () => {
    if (!selectedRoom) return
    if (!form.customer_name.trim()) { setFormError('Please enter your full name'); return }
    if (!form.phone.trim()) { setFormError('Please enter your phone number'); return }
    setFormError('')
    setSubmitting(true)

    try {
      const total = nights * selectedRoom.price_per_night
      const amountPaid = parseFloat(form.amount_paid) || 0
      const paymentStatus = amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid'

      const { data, error } = await supabase.from('bookings').insert({
        customer_name: form.customer_name.toUpperCase(),
        phone: form.phone, email: form.email || null,
        room_id: selectedRoom.id,
        check_in: checkIn, check_out: checkOut, nights,
        total_price: total, amount_paid: amountPaid,
        status: 'confirmed', payment_status: paymentStatus,
        payment_method: form.payment_method,
        booking_source: 'online',
        id_type: form.id_type || null,
        id_number: form.id_number || null,
        special_requests: form.special_requests || null,
      }).select('id').single()

      if (error) throw error
      setBookingRef(data.id)
      setStep('confirmed')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      setFormError('Booking failed: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const sendWhatsAppConfirmation = () => {
    if (!settings || !selectedRoom) return
    const msg = encodeURIComponent(
      `🏨 *${settings.hotel_name} — Booking Request*\n\n` +
      `Name: ${form.customer_name}\n` +
      `Phone: ${form.phone}\n` +
      `Room: ${selectedRoom.name} (${selectedRoom.type})\n` +
      `Check-in: ${fmtDate(checkIn)}\n` +
      `Check-out: ${fmtDate(checkOut)}\n` +
      `Nights: ${nights}\n` +
      `Total: ${fmt(nights * selectedRoom.price_per_night)}\n` +
      `Booking Ref: #${bookingRef}\n\n` +
      `Please confirm my booking. Thank you!`
    )
    window.open(`https://wa.me/${settings.whatsapp_number?.replace(/\D/g, '') || ''}?text=${msg}`, '_blank')
  }

  if (loading) return (
    <div className="min-h-screen bg-lodge flex items-center justify-center">
      <div className="text-center">
        <p className="font-display text-4xl italic text-gold mb-2">Grandpa's Lodge</p>
        <p className="text-white/30 text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  )

  const primaryColor = settings?.primary_color || '#C9A84C'

  // ── CONFIRMED PAGE ─────────────────────────────────────
  if (step === 'confirmed' && selectedRoom) {
    return (
      <div className="min-h-screen bg-lodge flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center animate-fade-up">
          <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-gold" />
          </div>
          <p className="font-display text-4xl italic text-white mb-2">Booking Confirmed!</p>
          <p className="text-white/50 text-sm mb-8">Your reservation has been received.</p>

          <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-6 text-left mb-6">
            <p className="text-xs font-mono text-gold/60 uppercase tracking-widest mb-4">Booking Summary</p>
            <div className="space-y-3">
              {[
                { label: 'Reference', val: `#${bookingRef}` },
                { label: 'Guest', val: form.customer_name },
                { label: 'Room', val: `${selectedRoom.name} (${selectedRoom.type})` },
                { label: 'Check In', val: fmtDate(checkIn) },
                { label: 'Check Out', val: fmtDate(checkOut) },
                { label: 'Nights', val: `${nights} night${nights !== 1 ? 's' : ''}` },
                { label: 'Total', val: fmt(nights * selectedRoom.price_per_night) },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-white/40">{row.label}</span>
                  <span className="text-white font-medium">{row.val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 mb-6 text-left">
            <p className="text-amber-400 text-xs font-medium mb-1">⏰ Next Step</p>
            <p className="text-white/60 text-sm">
              Please send us a WhatsApp message to confirm your booking and arrange payment.
              Check-in time is {settings?.check_in_time || '14:00'}.
            </p>
          </div>

          <div className="space-y-3">
            <button onClick={sendWhatsAppConfirmation}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
              <MessageCircle size={16} /> Confirm via WhatsApp
            </button>
            <button onClick={() => { setStep('browse'); setSelectedRoom(null) }}
              className="w-full py-3 bg-lodge-surface border border-lodge-border text-white/50 hover:text-white rounded-xl text-sm transition-all">
              Browse More Rooms
            </button>
            <a href={`/track/${bookingRef}`}
              className="block w-full py-3 text-center text-gold hover:text-gold-light text-sm transition-all">
              Track My Booking →
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── BOOKING FORM ───────────────────────────────────────
  if (step === 'booking' && selectedRoom) {
    const total = nights * selectedRoom.price_per_night
    return (
      <div className="min-h-screen bg-lodge">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-lodge/95 backdrop-blur-xl border-b border-lodge-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep('browse')} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
          <div>
            <p className="font-display text-lg italic text-white leading-none">{settings?.hotel_name}</p>
            <p className="text-xs text-gold">{selectedRoom.name} · {fmtDate(checkIn)} → {fmtDate(checkOut)}</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Room summary */}
          <div className="bg-lodge-surface border border-lodge-border rounded-2xl overflow-hidden">
            <img
              src={selectedRoom.images?.[0] || ROOM_IMAGES[selectedRoom.type] || ROOM_IMAGES.standard}
              alt={selectedRoom.name}
              className="w-full h-40 object-cover"
            />
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{selectedRoom.name}</p>
                <p className="text-xs text-white/40 capitalize">{selectedRoom.type} · {nights} night{nights !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-gold font-bold text-xl">{fmt(total)}</p>
                <p className="text-xs text-white/30">{fmt(selectedRoom.price_per_night)}/night</p>
              </div>
            </div>
          </div>

          {/* Guest details */}
          <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-mono text-gold/60 uppercase tracking-widest">Your Details</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Full Name *</label>
                <input type="text" placeholder="e.g. John Adeyemi"
                  value={form.customer_name}
                  onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all placeholder:text-white/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Phone *</label>
                  <input type="tel" placeholder="08012345678"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all placeholder:text-white/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Email</label>
                  <input type="email" placeholder="optional"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all placeholder:text-white/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">ID Type</label>
                  <select value={form.id_type}
                    onChange={e => setForm(p => ({ ...p, id_type: e.target.value }))}
                    className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all">
                    <option value="">Select...</option>
                    {['NIN', 'Voters Card', 'Passport', 'Drivers License'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">ID Number</label>
                  <input type="text" placeholder="optional"
                    value={form.id_number}
                    onChange={e => setForm(p => ({ ...p, id_number: e.target.value }))}
                    className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all placeholder:text-white/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Special Requests</label>
                <textarea rows={2} placeholder="Any special requests? (Early check-in, extra pillows, etc.)"
                  value={form.special_requests}
                  onChange={e => setForm(p => ({ ...p, special_requests: e.target.value }))}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all resize-none placeholder:text-white/20"
                />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-mono text-gold/60 uppercase tracking-widest">Payment</p>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'transfer', label: '🏦 Bank Transfer' },
                  { val: 'cash', label: '💵 Pay on Arrival' },
                ].map(m => (
                  <button key={m.val} type="button"
                    onClick={() => setForm(p => ({ ...p, payment_method: m.val }))}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                      form.payment_method === m.val
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-lodge-border text-white/40 hover:text-white hover:border-lodge-border'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {form.payment_method === 'transfer' && settings?.bank_name && (
              <div className="bg-lodge-card border border-lodge-border rounded-xl p-4 space-y-2">
                <p className="text-xs font-mono text-gold/60 uppercase tracking-widest mb-2">Transfer Details</p>
                {[
                  { label: 'Bank', val: settings.bank_name },
                  { label: 'Account No.', val: settings.account_number },
                  { label: 'Account Name', val: settings.account_name },
                  { label: 'Amount', val: fmt(total) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-white/40">{row.label}</span>
                    <span className="text-white font-medium">{row.val}</span>
                  </div>
                ))}
              </div>
            )}

            {form.payment_method === 'cash' && (
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                <p className="text-amber-400 text-xs">
                  💡 Please pay {fmt(total)} at the front desk upon arrival. Your room will be held for 2 hours after check-in time.
                </p>
              </div>
            )}
          </div>

          {/* Price summary */}
          <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-5">
            <p className="text-xs font-mono text-gold/60 uppercase tracking-widest mb-4">Price Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">{fmt(selectedRoom.price_per_night)} × {nights} night{nights !== 1 ? 's' : ''}</span>
                <span className="text-white">{fmt(total)}</span>
              </div>
            </div>
            <div className="gold-divider my-3" />
            <div className="flex justify-between">
              <span className="text-white font-semibold">Total</span>
              <span className="text-gold font-bold text-2xl">{fmt(total)}</span>
            </div>
          </div>

          {formError && (
            <p className="text-red-400 text-sm text-center">{formError}</p>
          )}

          <button onClick={handleBook} disabled={submitting}
            className="w-full py-4 font-bold text-lodge rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-base flex items-center justify-center gap-2"
            style={{ background: primaryColor }}>
            {submitting ? 'Processing...' : `Confirm Booking — ${fmt(total)}`}
          </button>

          <p className="text-center text-xs text-white/20">
            By booking, you agree to our check-in time of {settings?.check_in_time || '14:00'} and check-out time of {settings?.check_out_time || '12:00'}.
          </p>
        </div>
      </div>
    )
  }

  // ── BROWSE PAGE ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-lodge">

      {/* Announcement */}
      {settings?.show_announcement && settings.announcement_message && showAnnouncement && (
        <div className="relative z-50 px-4 py-2.5 text-center text-sm font-medium text-lodge flex items-center justify-center gap-2"
          style={{ background: primaryColor }}>
          <span>{settings.announcement_message}</span>
          <button onClick={() => setShowAnnouncement(false)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── HERO ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=80"
            alt="Hotel"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-lodge/40 via-lodge/60 to-lodge" />
        </div>

        <div className="relative z-10 px-4 pt-12 pb-10 text-center max-w-2xl mx-auto">
          {/* Nav */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <a href="/login" className="text-xs text-white/30 hover:text-gold transition-colors font-mono">Staff Login</a>
          </div>

          <p className="text-gold text-xs font-mono tracking-[0.3em] uppercase mb-4">
            {settings?.city || 'Nigeria'}
          </p>
          <h1 className="font-display text-5xl md:text-6xl italic text-white mb-2">
            {settings?.hotel_name?.split(' ').slice(0, -1).join(' ') || "Grandpa's"}
          </h1>
          <h2 className="font-display text-3xl md:text-4xl text-gold tracking-widest uppercase mb-6">
            {settings?.hotel_name?.split(' ').slice(-1)[0] || 'Lodge'}
          </h2>
          <div className="gold-divider max-w-24 mx-auto mb-6" />
          <p className="text-white/50 text-sm md:text-base max-w-md mx-auto">
            Experience luxury and comfort in the heart of {settings?.city || 'Nigeria'}.
            Where every stay tells a story.
          </p>

          {/* Search bar */}
          <div className="mt-8 bg-lodge-surface/90 backdrop-blur-md border border-lodge-border rounded-2xl p-4 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono text-gold/60 uppercase tracking-wider block mb-1">Check In</label>
                <input type="date" value={checkIn} min={today()}
                  onChange={e => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1)) }}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-gold/60 uppercase tracking-wider block mb-1">Check Out</label>
                <input type="date" value={checkOut} min={addDays(checkIn, 1)}
                  onChange={e => setCheckOut(e.target.value)}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-gold/60 uppercase tracking-wider block mb-1">Guests</label>
                <select value={guests} onChange={e => setGuests(parseInt(e.target.value))}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/40 transition-all">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} Guest{n !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-white/30">
                {nights} night{nights !== 1 ? 's' : ''} · {availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''} available
              </p>
              <div className="flex items-center gap-1.5 text-gold text-xs font-medium">
                <Search size={12} /> Check Availability
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROOMS ── */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-mono text-gold/60 uppercase tracking-widest mb-1">Available Rooms</p>
            <h2 className="font-display text-3xl italic text-white">Choose Your Room</h2>
          </div>
          <p className="text-white/30 text-sm">{nights} night{nights !== 1 ? 's' : ''}</p>
        </div>

        {availableRooms.length === 0 && (
          <div className="text-center py-16 text-white/20">
            <BedDouble size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-display text-2xl italic mb-2">No rooms available</p>
            <p className="text-sm">Try different dates or fewer guests</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {availableRooms.map(room => {
            const roomImg = room.images?.[0] || ROOM_IMAGES[room.type] || ROOM_IMAGES.standard
            const total = nights * room.price_per_night

            return (
              <div key={room.id}
                className="bg-lodge-surface border border-lodge-border rounded-2xl overflow-hidden hover:border-gold/30 transition-all group">

                {/* Image */}
                <div className="relative h-52 overflow-hidden">
                  <img src={roomImg} alt={room.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-lodge-surface/80 to-transparent" />
                  <div className="absolute top-3 right-3">
                    <span className="bg-lodge/80 backdrop-blur-sm border border-lodge-border text-gold text-xs font-mono px-3 py-1 rounded-full capitalize">
                      {room.type}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-4">
                    <p className="text-white font-display text-xl italic">{room.name}</p>
                    <p className="text-white/50 text-xs">Floor {room.floor} · Max {room.max_guests} guests</p>
                  </div>
                </div>

                {/* Details */}
                <div className="p-5">
                  {room.description && (
                    <p className="text-white/50 text-sm mb-4 leading-relaxed">{room.description}</p>
                  )}

                  {/* Amenities */}
                  {room.amenities?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {room.amenities.map(a => (
                        <span key={a} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-lodge-card border border-lodge-border rounded-lg text-white/40">
                          {AMENITY_ICONS[a] || null} {a}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Price + CTA */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-gold font-bold text-2xl">{fmt(total)}</p>
                      <p className="text-white/30 text-xs">{fmt(room.price_per_night)}/night · {nights} night{nights !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedRoom(room); setStep('booking'); window.scrollTo({ top: 0 }) }}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 text-lodge"
                      style={{ background: primaryColor }}>
                      Book Now <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── HOTEL INFO ── */}
      <div className="border-t border-lodge-border mt-8">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* About */}
            <div className="md:col-span-2">
              <p className="text-xs font-mono text-gold/60 uppercase tracking-widest mb-3">About Us</p>
              <h3 className="font-display text-2xl italic text-white mb-4">{settings?.hotel_name}</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Welcome to {settings?.hotel_name}, where timeless elegance meets modern comfort.
                Nestled in {settings?.city || 'Nigeria'}, we offer a sanctuary of refined luxury
                for the discerning traveller. Each room is thoughtfully designed to provide
                the perfect blend of style and functionality.
              </p>
              {settings?.address && (
                <div className="flex items-center gap-2 mt-4 text-white/40 text-sm">
                  <MapPin size={14} className="text-gold" />
                  {settings.address}
                  {settings.city && `, ${settings.city}`}
                </div>
              )}
            </div>

            {/* Contact & Info */}
            <div className="space-y-4">
              <p className="text-xs font-mono text-gold/60 uppercase tracking-widest">Information</p>
              <div className="space-y-3">
                {[
                  { label: 'Check-in', val: settings?.check_in_time || '14:00' },
                  { label: 'Check-out', val: settings?.check_out_time || '12:00' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-2 border-b border-lodge-border text-sm">
                    <span className="text-white/40">{row.label}</span>
                    <span className="text-white font-medium">{row.val}</span>
                  </div>
                ))}
              </div>

              {settings?.whatsapp_number && (
                <a href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 w-full py-3 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium transition-all">
                  <MessageCircle size={15} /> WhatsApp Us
                </a>
              )}

              <a href={`/track/0`}
                className="flex items-center gap-2 w-full py-3 px-4 bg-lodge-card border border-lodge-border text-white/40 hover:text-white rounded-xl text-sm font-medium transition-all">
                <Search size={15} /> Track My Booking
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-lodge-border px-4 py-6 text-center">
        <p className="text-white/20 text-xs font-mono">
          © {new Date().getFullYear()} {settings?.hotel_name} · Powered by Grandpa's Dream
        </p>
      </div>

      {/* Floating WhatsApp */}
      {settings?.whatsapp_number && (
        <a href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}`}
          target="_blank" rel="noreferrer"
          className="fixed bottom-6 right-4 z-40 w-14 h-14 bg-emerald-500 hover:bg-emerald-400 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30 transition-all active:scale-95">
          <MessageCircle size={24} className="text-white" />
        </a>
      )}
    </div>
  )
}
