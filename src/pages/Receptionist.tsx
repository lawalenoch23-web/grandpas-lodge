import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Room, Booking, HotelSettings, RoomStatus } from '../lib/types'
import {
  BedDouble, LogOut, Plus, X, Save, Phone, User,
  Calendar, CreditCard, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Search, MessageCircle, Printer,
  ArrowRightLeft, Wrench
} from 'lucide-react'

const STATUS_LABELS: Record<RoomStatus, string> = {
  available: 'Available', occupied: 'Occupied',
  cleaning: 'Cleaning', maintenance: 'Maintenance', reserved: 'Reserved'
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-red-500',
  cleaning: 'bg-yellow-500',
  maintenance: 'bg-purple-500',
  reserved: 'bg-blue-500',
}

const STATUS_TEXT: Record<RoomStatus, string> = {
  available: 'text-emerald-400',
  occupied: 'text-red-400',
  cleaning: 'text-yellow-400',
  maintenance: 'text-purple-400',
  reserved: 'text-blue-400',
}

const STATUS_BG: Record<RoomStatus, string> = {
  available: 'bg-emerald-500/10 border-emerald-500/20',
  occupied: 'bg-red-500/10 border-red-500/20',
  cleaning: 'bg-yellow-500/10 border-yellow-500/20',
  maintenance: 'bg-purple-500/10 border-purple-500/20',
  reserved: 'bg-blue-500/10 border-blue-500/20',
}

function fmt(n: number) { return `₦${n.toLocaleString()}` }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}
function nightsBetween(checkIn: string, checkOut: string) {
  const a = new Date(checkIn), b = new Date(checkOut)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}
function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

type Tab = 'rooms' | 'checkins' | 'search'

export default function Receptionist() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('rooms')
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [settings, setSettings] = useState<HotelSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Booking form
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [bookingForm, setBookingForm] = useState({
    customer_name: '', phone: '', email: '',
    check_in: today(), check_out: tomorrow(),
    payment_method: 'cash', amount_paid: '',
    id_type: '', id_number: '', special_requests: '', notes: '',
  })
  const [savingBooking, setSavingBooking] = useState(false)

  // Extend stay
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [extendBooking, setExtendBooking] = useState<Booking | null>(null)
  const [newCheckOut, setNewCheckOut] = useState('')

  // Receipt
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedBooking, setExpandedBooking] = useState<number | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'all'>('all')

  // Auth
  useEffect(() => {
    const session = localStorage.getItem('lodge_receptionist_session')
    if (!session) { navigate('/login'); return }
    const { time } = JSON.parse(session)
    if (Date.now() - time > 12 * 60 * 60 * 1000) {
      localStorage.removeItem('lodge_receptionist_session'); navigate('/login'); return
    }
    fetchAll()
    // Poll every 30s for new bookings
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAll = async () => {
    const [roomsRes, bookingsRes, settingsRes] = await Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('bookings').select('*, room:rooms(*)').order('created_at', { ascending: false }),
      supabase.from('hotel_settings').select('*').single(),
    ])
    if (roomsRes.data) setRooms(roomsRes.data)
    if (bookingsRes.data) setBookings(bookingsRes.data as any)
    if (settingsRes.data) setSettings(settingsRes.data)
    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('lodge_receptionist_session')
    navigate('/login')
  }

  // ── Open booking form ──────────────────────────────────
  const openBookingForm = (room: Room) => {
    setSelectedRoom(room)
    setBookingForm({
      customer_name: '', phone: '', email: '',
      check_in: today(), check_out: tomorrow(),
      payment_method: 'cash', amount_paid: '',
      id_type: '', id_number: '', special_requests: '', notes: '',
    })
    setShowBookingForm(true)
  }

  // ── Save booking ───────────────────────────────────────
  const saveBooking = async () => {
    if (!selectedRoom) return
    if (!bookingForm.customer_name.trim()) { alert('Customer name is required'); return }
    if (!bookingForm.phone.trim()) { alert('Phone number is required'); return }

    setSavingBooking(true)
    const nights = nightsBetween(bookingForm.check_in, bookingForm.check_out)
    const total = nights * selectedRoom.price_per_night
    const amountPaid = parseFloat(bookingForm.amount_paid) || 0
    const paymentStatus = amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid'

    try {
      const { data, error } = await supabase.from('bookings').insert({
        customer_name: bookingForm.customer_name.toUpperCase(),
        phone: bookingForm.phone,
        email: bookingForm.email || null,
        room_id: selectedRoom.id,
        check_in: bookingForm.check_in,
        check_out: bookingForm.check_out,
        nights,
        total_price: total,
        amount_paid: amountPaid,
        status: 'checked_in',
        payment_status: paymentStatus,
        payment_method: bookingForm.payment_method,
        booking_source: 'walkin',
        id_type: bookingForm.id_type || null,
        id_number: bookingForm.id_number || null,
        special_requests: bookingForm.special_requests || null,
        notes: bookingForm.notes || null,
      }).select('*, room:rooms(*)').single()

      if (error) throw error

      // Update room status to occupied
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', selectedRoom.id)

      setShowBookingForm(false)
      await fetchAll()

      // Show receipt
      setReceiptBooking(data as any)
      setShowReceipt(true)
    } catch (e: any) {
      alert('Failed to save booking: ' + e.message)
    } finally {
      setSavingBooking(false)
    }
  }

  // ── Check out ──────────────────────────────────────────
  const handleCheckOut = async (booking: Booking) => {
    if (!confirm(`Check out ${booking.customer_name}? This will mark the room for cleaning.`)) return
    try {
      await supabase.from('bookings').update({ status: 'checked_out' }).eq('id', booking.id)
      await supabase.from('rooms').update({ status: 'cleaning' }).eq('id', booking.room_id)
      // Create housekeeping task
      await supabase.from('housekeeping_tasks').insert({
        room_id: booking.room_id, status: 'pending', notes: `After checkout — ${booking.customer_name}`
      })
      await fetchAll()
      alert('✅ Checked out successfully. Room queued for cleaning.')
    } catch (e: any) {
      alert('Checkout failed: ' + e.message)
    }
  }

  // ── Extend stay ────────────────────────────────────────
  const openExtendModal = (booking: Booking) => {
    setExtendBooking(booking)
    setNewCheckOut(booking.check_out)
    setShowExtendModal(true)
  }

  const saveExtend = async () => {
    if (!extendBooking) return
    const nights = nightsBetween(extendBooking.check_in, newCheckOut)
    const total = nights * ((extendBooking as any).room?.price_per_night || 0)
    try {
      await supabase.from('bookings').update({
        check_out: newCheckOut, nights, total_price: total,
        payment_status: extendBooking.amount_paid >= total ? 'paid' :
          extendBooking.amount_paid > 0 ? 'partial' : 'unpaid'
      }).eq('id', extendBooking.id)
      setShowExtendModal(false)
      await fetchAll()
      alert('✅ Stay extended successfully!')
    } catch (e: any) {
      alert('Failed: ' + e.message)
    }
  }

  // ── Mark room status ───────────────────────────────────
  const updateRoomStatus = async (roomId: number, status: RoomStatus) => {
    await supabase.from('rooms').update({ status }).eq('id', roomId)
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status } : r))
  }

  // ── Report maintenance ─────────────────────────────────
  const reportMaintenance = async (room: Room) => {
    const issue = prompt(`Report maintenance issue for ${room.name}:`)
    if (!issue) return
    await supabase.from('maintenance_reports').insert({ room_id: room.id, issue, status: 'open' })
    await supabase.from('rooms').update({ status: 'maintenance' }).eq('id', room.id)
    await fetchAll()
    alert('✅ Maintenance reported. Room marked as under maintenance.')
  }

  // ── WhatsApp receipt ───────────────────────────────────
  const sendWhatsApp = (booking: Booking) => {
    const room = (booking as any).room
    const msg = encodeURIComponent(
      `🏨 *${settings?.hotel_name || "Grandpa's Lodge"} — Booking Confirmation*\n\n` +
      `Dear ${booking.customer_name},\n\n` +
      `Your booking has been confirmed!\n\n` +
      `🛏️ Room: ${room?.name || '—'} (${room?.type || ''})\n` +
      `📅 Check-in: ${fmtDate(booking.check_in)}\n` +
      `📅 Check-out: ${fmtDate(booking.check_out)}\n` +
      `🌙 Nights: ${booking.nights}\n` +
      `💰 Total: ${fmt(booking.total_price)}\n` +
      `✅ Paid: ${fmt(booking.amount_paid)}\n` +
      `⏳ Balance: ${fmt(booking.total_price - booking.amount_paid)}\n\n` +
      `Check-in time: ${settings?.check_in_time || '14:00'}\n` +
      `Check-out time: ${settings?.check_out_time || '12:00'}\n\n` +
      `Thank you for choosing us! 🙏`
    )
    window.open(`https://wa.me/${booking.phone.replace(/\D/g, '')}?text=${msg}`, '_blank')
  }

  // ── Computed data ──────────────────────────────────────
  const filteredRooms = rooms.filter(r =>
    statusFilter === 'all' || r.status === statusFilter
  )

  const activeBookings = bookings.filter(b => b.status === 'checked_in')
  const todayCheckouts = bookings.filter(b =>
    b.status === 'checked_in' && b.check_out === today()
  )
  const pendingPayments = bookings.filter(b =>
    b.payment_status !== 'paid' && b.status === 'checked_in'
  )

  const searchResults = searchQuery.trim().length > 0
    ? bookings.filter(b =>
        b.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.phone.includes(searchQuery) ||
        String(b.id).includes(searchQuery)
      )
    : []

  if (loading) return (
    <div className="min-h-screen bg-lodge flex items-center justify-center">
      <p className="font-display text-2xl text-gold italic animate-pulse">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-lodge text-white flex flex-col">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 bg-lodge/95 backdrop-blur-xl border-b border-lodge-border">
        <div className="px-4 md:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
              <span className="text-sm">🗝️</span>
            </div>
            <div>
              <p className="font-display text-base italic leading-none">{settings?.hotel_name || "Grandpa's Lodge"}</p>
              <p className="text-[9px] font-mono text-gold/50 uppercase tracking-widest">Reception</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden md:flex items-center gap-2">
            {[
              { label: 'Checked In', val: activeBookings.length, color: 'text-emerald-400' },
              { label: 'Checkout Today', val: todayCheckouts.length, color: 'text-amber-400' },
              { label: 'Pending Payment', val: pendingPayments.length, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-lodge-card border border-lodge-border px-3 py-1.5 rounded-lg text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.val}</p>
                <p className="text-[8px] text-white/30 uppercase font-mono">{s.label}</p>
              </div>
            ))}
          </div>

          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-lodge-border text-white/40 hover:text-red-400 hover:border-red-400/30 text-xs transition-all">
            <LogOut size={12} /> Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 md:px-6 pb-3">
          {[
            { id: 'rooms', icon: <BedDouble size={13} />, label: 'Room Grid' },
            { id: 'checkins', icon: <CheckCircle size={13} />, label: `Active (${activeBookings.length})` },
            { id: 'search', icon: <Search size={13} />, label: 'Search' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                tab === t.id ? 'bg-gold text-lodge' : 'text-white/40 hover:text-white hover:bg-lodge-card'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile stats */}
      <div className="md:hidden grid grid-cols-3 gap-2 px-4 py-3 border-b border-lodge-border">
        {[
          { label: 'In', val: activeBookings.length, color: 'text-emerald-400' },
          { label: 'Checkout', val: todayCheckouts.length, color: 'text-amber-400' },
          { label: 'Unpaid', val: pendingPayments.length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-lodge-card border border-lodge-border rounded-xl p-2 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-[9px] text-white/30 uppercase font-mono">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* ── ROOM GRID ── */}
        {tab === 'rooms' && (
          <div className="space-y-4 animate-fade-up">
            {/* Status filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['all', 'available', 'occupied', 'cleaning', 'maintenance', 'reserved'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize ${
                    statusFilter === s
                      ? 'bg-gold text-lodge'
                      : 'bg-lodge-card border border-lodge-border text-white/40 hover:text-white'
                  }`}>
                  {s !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[s as RoomStatus]}`} />}
                  {s === 'all' ? 'All Rooms' : STATUS_LABELS[s as RoomStatus]}
                  {s !== 'all' && (
                    <span className="text-[9px] opacity-60">
                      ({rooms.filter(r => r.status === s).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Room cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRooms.map(room => {
                const activeBooking = bookings.find(b => b.room_id === room.id && b.status === 'checked_in')
                const isCheckoutToday = activeBooking?.check_out === today()

                return (
                  <div key={room.id}
                    className={`bg-lodge-surface border rounded-2xl overflow-hidden transition-all hover:border-gold/20 ${
                      isCheckoutToday ? 'border-amber-500/40' : 'border-lodge-border'
                    }`}>

                    {/* Room header */}
                    <div className="p-4 border-b border-lodge-border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white">{room.name}</p>
                          <p className="text-xs text-white/40 capitalize">{room.type} · Floor {room.floor}</p>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_BG[room.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[room.status]}`} />
                          <span className={STATUS_TEXT[room.status]}>{STATUS_LABELS[room.status]}</span>
                        </div>
                      </div>
                      <p className="text-gold font-bold">{fmt(room.price_per_night)}<span className="text-xs text-white/30 font-normal">/night</span></p>
                    </div>

                    {/* Active booking info */}
                    {activeBooking && (
                      <div className={`px-4 py-3 border-b border-lodge-border ${isCheckoutToday ? 'bg-amber-500/5' : 'bg-lodge-card/50'}`}>
                        {isCheckoutToday && (
                          <p className="text-amber-400 text-[9px] font-mono uppercase tracking-widest mb-1">⚡ Checkout Today</p>
                        )}
                        <p className="text-sm font-medium text-white truncate">{activeBooking.customer_name}</p>
                        <p className="text-xs text-white/40">{activeBooking.phone}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[10px] text-white/40">
                            {fmtDate(activeBooking.check_in)} → {fmtDate(activeBooking.check_out)}
                          </p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                            activeBooking.payment_status === 'paid' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                            activeBooking.payment_status === 'partial' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                            'text-red-400 border-red-500/20 bg-red-500/10'
                          }`}>{activeBooking.payment_status}</span>
                        </div>
                        {activeBooking.payment_status !== 'paid' && (
                          <p className="text-xs text-red-400 mt-1">
                            Balance: {fmt(activeBooking.total_price - activeBooking.amount_paid)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Amenities */}
                    {room.amenities?.length > 0 && !activeBooking && (
                      <div className="px-4 py-3 border-b border-lodge-border">
                        <div className="flex flex-wrap gap-1">
                          {room.amenities.slice(0, 4).map(a => (
                            <span key={a} className="text-[9px] px-1.5 py-0.5 bg-lodge-card border border-lodge-border rounded text-white/40">{a}</span>
                          ))}
                          {room.amenities.length > 4 && (
                            <span className="text-[9px] text-white/20">+{room.amenities.length - 4}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="p-3 space-y-2">
                      {room.status === 'available' && (
                        <button onClick={() => openBookingForm(room)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-gold hover:bg-gold-light text-lodge rounded-xl text-xs font-semibold transition-all active:scale-95">
                          <Plus size={13} /> Check In Guest
                        </button>
                      )}

                      {room.status === 'occupied' && activeBooking && (
                        <div className="space-y-1.5">
                          <button onClick={() => handleCheckOut(activeBooking)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold transition-all">
                            <CheckCircle size={13} /> Check Out
                          </button>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => openExtendModal(activeBooking)}
                              className="flex items-center justify-center gap-1 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 rounded-xl text-[10px] font-medium transition-all">
                              <ArrowRightLeft size={10} /> Extend
                            </button>
                            <button onClick={() => sendWhatsApp(activeBooking)}
                              className="flex items-center justify-center gap-1 py-2 bg-lodge-card hover:bg-lodge-border border border-lodge-border text-white/40 hover:text-white rounded-xl text-[10px] font-medium transition-all">
                              <MessageCircle size={10} /> WhatsApp
                            </button>
                          </div>
                        </div>
                      )}

                      {room.status === 'cleaning' && (
                        <button onClick={() => updateRoomStatus(room.id, 'available')}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-lodge-card hover:bg-yellow-500/10 border border-lodge-border hover:border-yellow-500/30 text-white/40 hover:text-yellow-400 rounded-xl text-xs font-medium transition-all">
                          <CheckCircle size={13} /> Mark as Clean
                        </button>
                      )}

                      {room.status === 'maintenance' && (
                        <button onClick={() => updateRoomStatus(room.id, 'available')}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-lodge-card hover:bg-purple-500/10 border border-lodge-border hover:border-purple-500/30 text-white/40 hover:text-purple-400 rounded-xl text-xs font-medium transition-all">
                          <Wrench size={13} /> Mark as Fixed
                        </button>
                      )}

                      {room.status === 'reserved' && (
                        <button onClick={() => openBookingForm(room)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-semibold transition-all">
                          <CheckCircle size={13} /> Check In (Reserved)
                        </button>
                      )}

                      {/* Report maintenance (for available/cleaning rooms) */}
                      {(room.status === 'available' || room.status === 'cleaning') && (
                        <button onClick={() => reportMaintenance(room)}
                          className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-white/20 hover:text-red-400 transition-colors">
                          <AlertTriangle size={10} /> Report Issue
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {filteredRooms.length === 0 && (
                <div className="col-span-full text-center py-16 text-white/20">
                  <BedDouble size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-display text-2xl italic mb-2">No rooms found</p>
                  <p className="text-sm">Try a different filter</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ACTIVE CHECK-INS ── */}
        {tab === 'checkins' && (
          <div className="space-y-3 animate-fade-up">
            <h2 className="font-display text-2xl italic text-white">Active Guests</h2>

            {activeBookings.length === 0 && (
              <div className="text-center py-16 text-white/20">
                <BedDouble size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-display text-2xl italic mb-2">No active guests</p>
                <p className="text-sm">Check in guests from the Room Grid</p>
              </div>
            )}

            {activeBookings.map(booking => {
              const room = (booking as any).room
              const isExpanded = expandedBooking === booking.id
              const isCheckoutToday = booking.check_out === today()
              const balance = booking.total_price - booking.amount_paid

              return (
                <div key={booking.id}
                  className={`bg-lodge-surface border rounded-2xl overflow-hidden transition-all ${
                    isCheckoutToday ? 'border-amber-500/30' : 'border-lodge-border'
                  }`}>
                  <div className="p-4 cursor-pointer" onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                        <span className="font-mono text-gold text-xs">#{booking.id}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-white truncate">{booking.customer_name}</p>
                          {isCheckoutToday && (
                            <span className="text-[9px] px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full font-mono whitespace-nowrap">
                              Checkout Today
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40">{room?.name} · {booking.nights} night{booking.nights !== 1 ? 's' : ''}</p>
                        <p className="text-xs text-white/30">{booking.phone}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-gold font-bold">{fmt(booking.total_price)}</p>
                        {balance > 0 && <p className="text-red-400 text-xs">Balance: {fmt(balance)}</p>}
                        {balance === 0 && <p className="text-emerald-400 text-xs">Fully Paid ✓</p>}
                      </div>
                      <div className="text-white/20 ml-2">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-lodge-border">
                      <div className="p-4 grid grid-cols-2 gap-3 text-xs">
                        {[
                          { label: 'Room', val: room?.name },
                          { label: 'Type', val: room?.type },
                          { label: 'Check In', val: fmtDate(booking.check_in) },
                          { label: 'Check Out', val: fmtDate(booking.check_out) },
                          { label: 'Total', val: fmt(booking.total_price) },
                          { label: 'Paid', val: fmt(booking.amount_paid) },
                          { label: 'Balance', val: fmt(balance) },
                          { label: 'Payment', val: booking.payment_method },
                          { label: 'ID Type', val: booking.id_type || '—' },
                          { label: 'ID Number', val: booking.id_number || '—' },
                        ].map(row => (
                          <div key={row.label}>
                            <p className="text-white/30 uppercase font-mono text-[9px] tracking-wider">{row.label}</p>
                            <p className="text-white capitalize">{row.val}</p>
                          </div>
                        ))}
                        {booking.special_requests && (
                          <div className="col-span-2">
                            <p className="text-white/30 uppercase font-mono text-[9px] tracking-wider">Special Requests</p>
                            <p className="text-white">{booking.special_requests}</p>
                          </div>
                        )}
                      </div>
                      <div className="p-4 pt-0 flex flex-wrap gap-2">
                        <button onClick={() => handleCheckOut(booking)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-medium transition-all">
                          <CheckCircle size={12} /> Check Out
                        </button>
                        <button onClick={() => openExtendModal(booking)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-medium transition-all">
                          <ArrowRightLeft size={12} /> Extend Stay
                        </button>
                        <button onClick={() => sendWhatsApp(booking)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-lodge-card border border-lodge-border text-white/40 hover:text-white rounded-xl text-xs font-medium transition-all">
                          <MessageCircle size={12} /> WhatsApp
                        </button>
                        <button onClick={() => { setReceiptBooking(booking); setShowReceipt(true) }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-lodge-card border border-lodge-border text-white/40 hover:text-white rounded-xl text-xs font-medium transition-all">
                          <Printer size={12} /> Receipt
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── SEARCH ── */}
        {tab === 'search' && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="font-display text-2xl italic text-white">Search Bookings</h2>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input
                type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, or booking ID..."
                autoFocus
                className="w-full bg-lodge-surface border border-lodge-border rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/40 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {searchQuery.trim().length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-white/30 font-mono">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
                {searchResults.map(booking => {
                  const room = (booking as any).room
                  const balance = booking.total_price - booking.amount_paid
                  return (
                    <div key={booking.id} className="bg-lodge-surface border border-lodge-border rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-gold font-mono text-xs">#{booking.id}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium capitalize ${
                              booking.status === 'checked_in' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                              booking.status === 'checked_out' ? 'text-white/40 border-lodge-border bg-lodge-card' :
                              booking.status === 'cancelled' ? 'text-red-400 border-red-500/20 bg-red-500/10' :
                              'text-blue-400 border-blue-500/20 bg-blue-500/10'
                            }`}>{booking.status.replace('_', ' ')}</span>
                          </div>
                          <p className="font-semibold text-white">{booking.customer_name}</p>
                          <p className="text-xs text-white/40">{booking.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gold font-bold">{fmt(booking.total_price)}</p>
                          {balance > 0 && <p className="text-red-400 text-xs">Balance: {fmt(balance)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-white/40">
                        <span>{room?.name} · {booking.nights} night{booking.nights !== 1 ? 's' : ''}</span>
                        <span>{fmtDate(booking.check_in)} → {fmtDate(booking.check_out)}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => sendWhatsApp(booking)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-lodge-card border border-lodge-border text-white/40 hover:text-white rounded-lg text-xs transition-all">
                          <MessageCircle size={11} /> WhatsApp
                        </button>
                        <button onClick={() => { setReceiptBooking(booking); setShowReceipt(true) }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-lodge-card border border-lodge-border text-white/40 hover:text-white rounded-lg text-xs transition-all">
                          <Printer size={11} /> Receipt
                        </button>
                      </div>
                    </div>
                  )
                })}
                {searchResults.length === 0 && (
                  <div className="text-center py-12 text-white/20">
                    <Search size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No bookings found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            )}

            {searchQuery.trim().length === 0 && (
              <div className="text-center py-16 text-white/20">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-display text-2xl italic mb-2">Search Bookings</p>
                <p className="text-sm">Type a guest name, phone number, or booking ID</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BOOKING FORM MODAL ── */}
      {showBookingForm && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-lodge-surface border border-lodge-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-lodge-surface border-b border-lodge-border p-5 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl italic text-white">Check In Guest</h3>
                <p className="text-xs text-gold mt-0.5">{selectedRoom.name} · {fmt(selectedRoom.price_per_night)}/night</p>
              </div>
              <button onClick={() => setShowBookingForm(false)} className="text-white/30 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Guest info */}
              <div>
                <p className="text-[10px] font-mono text-gold/60 uppercase tracking-widest mb-3">Guest Information</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Full Name *</label>
                    <input type="text" placeholder="e.g. JOHN ADEYEMI"
                      value={bookingForm.customer_name}
                      onChange={e => setBookingForm(p => ({ ...p, customer_name: e.target.value }))}
                      className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 mb-1.5 block">Phone *</label>
                      <input type="tel" placeholder="08012345678"
                        value={bookingForm.phone}
                        onChange={e => setBookingForm(p => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1.5 block">Email</label>
                      <input type="email" placeholder="optional"
                        value={bookingForm.email}
                        onChange={e => setBookingForm(p => ({ ...p, email: e.target.value }))}
                        className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 mb-1.5 block">ID Type</label>
                      <select value={bookingForm.id_type}
                        onChange={e => setBookingForm(p => ({ ...p, id_type: e.target.value }))}
                        className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all">
                        <option value="">Select...</option>
                        {['NIN', 'Voters Card', 'Passport', 'Drivers License', 'Staff ID'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1.5 block">ID Number</label>
                      <input type="text" placeholder="ID number"
                        value={bookingForm.id_number}
                        onChange={e => setBookingForm(p => ({ ...p, id_number: e.target.value }))}
                        className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stay info */}
              <div>
                <p className="text-[10px] font-mono text-gold/60 uppercase tracking-widest mb-3">Stay Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Check In</label>
                    <input type="date" value={bookingForm.check_in}
                      onChange={e => setBookingForm(p => ({ ...p, check_in: e.target.value }))}
                      className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Check Out</label>
                    <input type="date" value={bookingForm.check_out}
                      min={bookingForm.check_in}
                      onChange={e => setBookingForm(p => ({ ...p, check_out: e.target.value }))}
                      className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                    />
                  </div>
                </div>

                {/* Price summary */}
                <div className="mt-3 bg-lodge-card border border-lodge-border rounded-xl p-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/40">{fmt(selectedRoom.price_per_night)} × {nightsBetween(bookingForm.check_in, bookingForm.check_out)} night{nightsBetween(bookingForm.check_in, bookingForm.check_out) !== 1 ? 's' : ''}</span>
                    <span className="text-white font-semibold">{fmt(nightsBetween(bookingForm.check_in, bookingForm.check_out) * selectedRoom.price_per_night)}</span>
                  </div>
                  <div className="gold-divider my-2" />
                  <div className="flex justify-between">
                    <span className="text-white/60 font-medium">Total</span>
                    <span className="text-gold font-bold text-lg">{fmt(nightsBetween(bookingForm.check_in, bookingForm.check_out) * selectedRoom.price_per_night)}</span>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div>
                <p className="text-[10px] font-mono text-gold/60 uppercase tracking-widest mb-3">Payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Method</label>
                    <select value={bookingForm.payment_method}
                      onChange={e => setBookingForm(p => ({ ...p, payment_method: e.target.value }))}
                      className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all">
                      {['cash', 'transfer', 'card', 'paystack'].map(m => (
                        <option key={m} value={m} className="capitalize">{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Amount Paid (₦)</label>
                    <input type="number" placeholder="0"
                      value={bookingForm.amount_paid}
                      onChange={e => setBookingForm(p => ({ ...p, amount_paid: e.target.value }))}
                      className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Special requests */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Special Requests</label>
                <textarea rows={2} placeholder="Any special requests or notes..."
                  value={bookingForm.special_requests}
                  onChange={e => setBookingForm(p => ({ ...p, special_requests: e.target.value }))}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={saveBooking} disabled={savingBooking}
                  className="flex-1 py-3.5 bg-gold hover:bg-gold-light disabled:opacity-50 text-lodge font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                  <CheckCircle size={15} />
                  {savingBooking ? 'Checking in...' : 'Complete Check In'}
                </button>
                <button onClick={() => setShowBookingForm(false)}
                  className="px-5 py-3.5 bg-lodge-card border border-lodge-border text-white/50 hover:text-white rounded-xl text-sm transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXTEND STAY MODAL ── */}
      {showExtendModal && extendBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-xl italic text-white">Extend Stay</h3>
              <button onClick={() => setShowExtendModal(false)} className="text-white/30 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-white/60 mb-4">{extendBooking.customer_name}</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Current Check Out</label>
                <p className="text-white font-medium">{fmtDate(extendBooking.check_out)}</p>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">New Check Out Date</label>
                <input type="date" value={newCheckOut}
                  min={extendBooking.check_out}
                  onChange={e => setNewCheckOut(e.target.value)}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                />
              </div>
              {newCheckOut && newCheckOut !== extendBooking.check_out && (
                <div className="bg-lodge-card border border-lodge-border rounded-xl p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">New Total</span>
                    <span className="text-gold font-bold">
                      {fmt(nightsBetween(extendBooking.check_in, newCheckOut) * ((extendBooking as any).room?.price_per_night || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-white/30">Extra Nights</span>
                    <span className="text-white/60">
                      {nightsBetween(extendBooking.check_out, newCheckOut)} added
                    </span>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={saveExtend}
                  className="flex-1 py-3 bg-gold hover:bg-gold-light text-lodge font-semibold rounded-xl text-sm transition-all">
                  Confirm Extension
                </button>
                <button onClick={() => setShowExtendModal(false)}
                  className="px-5 py-3 bg-lodge-card border border-lodge-border text-white/50 rounded-xl text-sm transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIPT MODAL ── */}
      {showReceipt && receiptBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            {/* Receipt content */}
            <div ref={receiptRef} className="p-6 bg-white text-gray-900">
              <div className="text-center mb-5">
                <h2 className="font-bold text-xl text-gray-900">{settings?.hotel_name || "Grandpa's Lodge"}</h2>
                {settings?.address && <p className="text-xs text-gray-500 mt-0.5">{settings.address}</p>}
                {settings?.whatsapp_number && <p className="text-xs text-gray-500">{settings.whatsapp_number}</p>}
                <div className="h-px bg-gray-200 my-3" />
                <p className="text-xs font-mono text-gray-400">BOOKING RECEIPT</p>
                <p className="text-xs text-gray-400">#{receiptBooking.id} · {new Date().toLocaleDateString('en-NG')}</p>
              </div>

              <div className="space-y-2 text-sm mb-4">
                {[
                  { label: 'Guest', val: receiptBooking.customer_name },
                  { label: 'Phone', val: receiptBooking.phone },
                  { label: 'Room', val: (receiptBooking as any).room?.name || '—' },
                  { label: 'Check In', val: fmtDate(receiptBooking.check_in) },
                  { label: 'Check Out', val: fmtDate(receiptBooking.check_out) },
                  { label: 'Nights', val: receiptBooking.nights },
                  { label: 'Rate/Night', val: fmt((receiptBooking as any).room?.price_per_night || 0) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-medium text-gray-900">{row.val}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">{fmt(receiptBooking.total_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-bold text-green-600">{fmt(receiptBooking.amount_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Balance</span>
                  <span className={`font-bold ${receiptBooking.total_price - receiptBooking.amount_paid > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {fmt(receiptBooking.total_price - receiptBooking.amount_paid)}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">Check-in: {settings?.check_in_time || '14:00'} · Check-out: {settings?.check_out_time || '12:00'}</p>
                <p className="text-xs text-gray-400 mt-1">Thank you for your stay! 🙏</p>
              </div>
            </div>

            {/* Receipt actions */}
            <div className="bg-gray-50 border-t border-gray-100 p-4 flex gap-3">
              <button onClick={() => sendWhatsApp(receiptBooking)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all">
                <MessageCircle size={14} /> WhatsApp
              </button>
              <button onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-medium transition-all">
                <Printer size={14} /> Print
              </button>
              <button onClick={() => setShowReceipt(false)}
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm transition-all">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
