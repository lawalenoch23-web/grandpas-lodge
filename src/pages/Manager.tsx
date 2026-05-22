import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Room, Booking, HotelSettings, RoomStatus } from '../lib/types'
import {
  LayoutDashboard, BedDouble, CalendarDays, Settings,
  LogOut, TrendingUp, Users, CheckCircle, AlertTriangle,
  Plus, Edit2, Trash2, X, Save, Eye, EyeOff
} from 'lucide-react'

const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'executive', 'presidential']
const STATUS_LABELS: Record<RoomStatus, string> = {
  available: 'Available', occupied: 'Occupied',
  cleaning: 'Cleaning', maintenance: 'Maintenance', reserved: 'Reserved'
}

function statusClass(status: RoomStatus) {
  const map: Record<RoomStatus, string> = {
    available: 'status-available', occupied: 'status-occupied',
    cleaning: 'status-cleaning', maintenance: 'status-maintenance',
    reserved: 'status-reserved'
  }
  return map[status]
}

function fmt(n: number) { return `₦${n.toLocaleString()}` }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Manager() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'dashboard' | 'rooms' | 'bookings' | 'settings'>('dashboard')
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [settings, setSettings] = useState<HotelSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Room form
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomForm, setRoomForm] = useState({
    name: '', type: 'standard', floor: '1', price_per_night: '',
    max_guests: '2', description: '', amenities: '',
  })

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Partial<HotelSettings>>({})
  const [savingSettings, setSavingSettings] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)

  // Auth check
  useEffect(() => {
    const session = localStorage.getItem('lodge_manager_session')
    if (!session) { navigate('/login'); return }
    const { time } = JSON.parse(session)
    if (Date.now() - time > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('lodge_manager_session'); navigate('/login'); return
    }
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [roomsRes, bookingsRes, settingsRes] = await Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('bookings').select('*, room:rooms(name, type)').order('created_at', { ascending: false }),
      supabase.from('hotel_settings').select('*').single(),
    ])
    if (roomsRes.data) setRooms(roomsRes.data)
    if (bookingsRes.data) setBookings(bookingsRes.data as any)
    if (settingsRes.data) { setSettings(settingsRes.data); setSettingsForm(settingsRes.data) }
    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('lodge_manager_session')
    navigate('/login')
  }

  // ── Rooms ──────────────────────────────────────────────
  const openRoomForm = (room?: Room) => {
    if (room) {
      setEditingRoom(room)
      setRoomForm({
        name: room.name, type: room.type, floor: String(room.floor),
        price_per_night: String(room.price_per_night),
        max_guests: String(room.max_guests),
        description: room.description || '',
        amenities: room.amenities?.join(', ') || '',
      })
    } else {
      setEditingRoom(null)
      setRoomForm({ name: '', type: 'standard', floor: '1', price_per_night: '', max_guests: '2', description: '', amenities: '' })
    }
    setShowRoomForm(true)
  }

  const saveRoom = async () => {
    const payload = {
      name: roomForm.name,
      type: roomForm.type,
      floor: parseInt(roomForm.floor) || 1,
      price_per_night: parseFloat(roomForm.price_per_night) || 0,
      max_guests: parseInt(roomForm.max_guests) || 2,
      description: roomForm.description,
      amenities: roomForm.amenities.split(',').map(a => a.trim()).filter(Boolean),
    }
    if (editingRoom) {
      await supabase.from('rooms').update(payload).eq('id', editingRoom.id)
    } else {
      await supabase.from('rooms').insert({ ...payload, status: 'available', is_active: true, images: [] })
    }
    setShowRoomForm(false)
    fetchAll()
  }

  const deleteRoom = async (id: number) => {
    if (!confirm('Delete this room? This cannot be undone.')) return
    await supabase.from('rooms').delete().eq('id', id)
    fetchAll()
  }

  const updateRoomStatus = async (id: number, status: RoomStatus) => {
    await supabase.from('rooms').update({ status }).eq('id', id)
    setRooms(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  // ── Bookings ───────────────────────────────────────────
  const updateBookingStatus = async (id: number, status: string) => {
    await supabase.from('bookings').update({ status }).eq('id', id)
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as any } : b))
  }

  // ── Settings ───────────────────────────────────────────
  const saveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    await supabase.from('hotel_settings').update(settingsForm).eq('id', settings.id)
    await fetchAll()
    setSavingSettings(false)
    alert('✅ Settings saved!')
  }

  // ── Stats ──────────────────────────────────────────────
  const totalRooms = rooms.length
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length
  const availableRooms = rooms.filter(r => r.status === 'available').length
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
  const todayRevenue = bookings
    .filter(b => b.payment_status !== 'unpaid' && b.created_at?.startsWith(new Date().toISOString().split('T')[0]))
    .reduce((sum, b) => sum + (b.amount_paid || 0), 0)
  const activeBookings = bookings.filter(b => ['confirmed', 'checked_in'].includes(b.status)).length
  const pendingPayments = bookings.filter(b => b.payment_status === 'unpaid' && b.status !== 'cancelled').length

  if (loading) return (
    <div className="min-h-screen bg-lodge flex items-center justify-center">
      <p className="font-display text-2xl text-gold italic animate-pulse-soft">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-lodge text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-lodge/95 backdrop-blur-xl border-b border-lodge-border">
        <div className="px-4 md:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
              <span className="text-gold text-sm">🏨</span>
            </div>
            <div>
              <p className="font-display text-base italic text-white leading-none">
                {settings?.hotel_name || "Grandpa's Lodge"}
              </p>
              <p className="text-[9px] font-mono text-gold/50 uppercase tracking-widest">Manager Portal</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-lodge-border
              text-white/40 hover:text-red-400 hover:border-red-400/30 text-xs transition-all">
            <LogOut size={12} /> Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 md:px-6 pb-3 overflow-x-auto">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={13} />, label: 'Dashboard' },
            { id: 'rooms', icon: <BedDouble size={13} />, label: 'Rooms' },
            { id: 'bookings', icon: <CalendarDays size={13} />, label: 'Bookings' },
            { id: 'settings', icon: <Settings size={13} />, label: 'Settings' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                tab === t.id
                  ? 'bg-gold text-lodge'
                  : 'text-white/40 hover:text-white hover:bg-lodge-card'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full">

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div className="space-y-6 animate-fade-up">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Occupancy', value: `${occupancyRate}%`, sub: `${occupiedRooms}/${totalRooms} rooms`, color: 'text-gold', icon: <TrendingUp size={18} className="text-gold" /> },
                { label: "Today's Revenue", value: fmt(todayRevenue), sub: 'Payments received', color: 'text-green-400', icon: <TrendingUp size={18} className="text-green-400" /> },
                { label: 'Active Bookings', value: activeBookings, sub: 'Confirmed & checked in', color: 'text-blue-400', icon: <Users size={18} className="text-blue-400" /> },
                { label: 'Pending Payments', value: pendingPayments, sub: 'Awaiting collection', color: 'text-amber-400', icon: <AlertTriangle size={18} className="text-amber-400" /> },
              ].map(stat => (
                <div key={stat.label} className="bg-lodge-surface border border-lodge-border rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    {stat.icon}
                  </div>
                  <p className={`text-2xl font-bold font-display ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-white/40 mt-1">{stat.label}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Room grid overview */}
            <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-5">
              <h3 className="font-display text-xl italic text-white mb-4">Room Status Overview</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {rooms.map(room => (
                  <div key={room.id} className="bg-lodge-card border border-lodge-border rounded-xl p-3 text-center">
                    <p className="text-xs font-semibold text-white truncate mb-1">{room.name}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${statusClass(room.status)}`}>
                      {STATUS_LABELS[room.status]}
                    </span>
                    <p className="text-[9px] text-white/30 mt-1 capitalize">{room.type}</p>
                  </div>
                ))}
                {rooms.length === 0 && (
                  <div className="col-span-full text-center py-8 text-white/20">
                    <BedDouble size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No rooms yet — add rooms in the Rooms tab</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent bookings */}
            <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-5">
              <h3 className="font-display text-xl italic text-white mb-4">Recent Bookings</h3>
              <div className="space-y-2">
                {bookings.slice(0, 8).map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-3 border-b border-lodge-border/50 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-gold text-xs font-mono">#{b.id}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{b.customer_name}</p>
                      <p className="text-xs text-white/40">{(b as any).room?.name} · {fmtDate(b.check_in)} → {fmtDate(b.check_out)}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${
                      b.status === 'checked_in' ? 'status-occupied' :
                      b.status === 'confirmed' ? 'status-reserved' :
                      b.status === 'checked_out' ? 'status-available' : 'status-cleaning'
                    }`}>{b.status.replace('_', ' ')}</span>
                    <p className="text-sm font-semibold text-gold flex-shrink-0">{fmt(b.total_price)}</p>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <p className="text-center py-8 text-white/20 text-sm">No bookings yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ROOMS ── */}
        {tab === 'rooms' && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl italic text-white">Room Management</h2>
              <button onClick={() => openRoomForm()}
                className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-light text-lodge rounded-xl text-sm font-medium transition-all">
                <Plus size={15} /> Add Room
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map(room => (
                <div key={room.id} className="bg-lodge-surface border border-lodge-border rounded-2xl overflow-hidden hover:border-gold/30 transition-all">
                  {/* Room image placeholder */}
                  <div className="h-28 bg-lodge-card flex items-center justify-center border-b border-lodge-border">
                    <BedDouble size={32} className="text-white/10" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-white">{room.name}</p>
                        <p className="text-xs text-white/40 capitalize">{room.type} · Floor {room.floor}</p>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${statusClass(room.status)}`}>
                        {STATUS_LABELS[room.status]}
                      </span>
                    </div>
                    <p className="text-gold font-bold text-lg">{fmt(room.price_per_night)}<span className="text-xs text-white/30 font-normal">/night</span></p>
                    <p className="text-xs text-white/30 mt-1">Max {room.max_guests} guests</p>

                    {/* Status changer */}
                    <select
                      value={room.status}
                      onChange={e => updateRoomStatus(room.id, e.target.value as RoomStatus)}
                      className="w-full mt-3 bg-lodge-card border border-lodge-border rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-gold/40 transition-all"
                    >
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>

                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openRoomForm(room)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-lodge-card hover:bg-blue-600/20 border border-lodge-border hover:border-blue-500/30 text-white/50 hover:text-blue-400 rounded-lg text-xs transition-all">
                        <Edit2 size={11} /> Edit
                      </button>
                      <button onClick={() => deleteRoom(room.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-lodge-card hover:bg-red-600/20 border border-lodge-border hover:border-red-500/30 text-white/50 hover:text-red-400 rounded-lg text-xs transition-all">
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {rooms.length === 0 && (
                <div className="col-span-full text-center py-16 text-white/20">
                  <BedDouble size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-display text-2xl italic mb-2">No rooms yet</p>
                  <p className="text-sm">Click "Add Room" to get started</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BOOKINGS ── */}
        {tab === 'bookings' && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="font-display text-2xl italic text-white">All Bookings</h2>
            <div className="bg-lodge-surface border border-lodge-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-lodge-border">
                      {['#', 'Guest', 'Room', 'Check In', 'Check Out', 'Nights', 'Total', 'Status', 'Payment', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-gold/60 uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lodge-border/50">
                    {bookings.map(b => (
                      <tr key={b.id} className="hover:bg-lodge-card/50 transition-colors">
                        <td className="px-4 py-3 text-gold font-mono text-xs">#{b.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-white whitespace-nowrap">{b.customer_name}</p>
                          <p className="text-[10px] text-white/40">{b.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">{(b as any).room?.name || '—'}</td>
                        <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">{fmtDate(b.check_in)}</td>
                        <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">{fmtDate(b.check_out)}</td>
                        <td className="px-4 py-3 text-white/60 text-xs text-center">{b.nights}</td>
                        <td className="px-4 py-3 text-gold font-semibold whitespace-nowrap">{fmt(b.total_price)}</td>
                        <td className="px-4 py-3">
                          <select value={b.status}
                            onChange={e => updateBookingStatus(b.id, e.target.value)}
                            className={`text-[10px] px-2 py-1 rounded-lg border bg-transparent font-medium focus:outline-none capitalize ${
                              b.status === 'checked_in' ? 'status-occupied' :
                              b.status === 'confirmed' ? 'status-reserved' :
                              b.status === 'checked_out' ? 'status-available' :
                              b.status === 'cancelled' ? 'bg-red-900/30 text-red-400 border-red-700' : 'status-cleaning'
                            }`}>
                            {['pending','confirmed','checked_in','checked_out','cancelled','no_show'].map(s => (
                              <option key={s} value={s}>{s.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                            b.payment_status === 'paid' ? 'status-available' :
                            b.payment_status === 'partial' ? 'status-cleaning' : 'status-occupied'
                          }`}>{b.payment_status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-white/30 hover:text-gold transition-colors text-xs">View</button>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-16 text-center text-white/20 text-sm">No bookings yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div className="space-y-6 animate-fade-up max-w-2xl">
            <h2 className="font-display text-2xl italic text-white">Hotel Settings</h2>

            <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-6 space-y-5">
              <p className="text-xs font-mono text-gold/60 uppercase tracking-widest">General</p>
              {[
                { label: 'Hotel Name', key: 'hotel_name', type: 'text' },
                { label: 'Address', key: 'address', type: 'text' },
                { label: 'City', key: 'city', type: 'text' },
                { label: 'WhatsApp Number', key: 'whatsapp_number', type: 'text' },
                { label: 'Check-in Time', key: 'check_in_time', type: 'time' },
                { label: 'Check-out Time', key: 'check_out_time', type: 'time' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-white/40 mb-1.5 block">{f.label}</label>
                  <input type={f.type}
                    value={(settingsForm as any)[f.key] || ''}
                    onChange={e => setSettingsForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                  />
                </div>
              ))}
            </div>

            <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-6 space-y-5">
              <p className="text-xs font-mono text-gold/60 uppercase tracking-widest">Banking</p>
              {[
                { label: 'Bank Name', key: 'bank_name' },
                { label: 'Account Number', key: 'account_number' },
                { label: 'Account Name', key: 'account_name' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-white/40 mb-1.5 block">{f.label}</label>
                  <input type="text"
                    value={(settingsForm as any)[f.key] || ''}
                    onChange={e => setSettingsForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                  />
                </div>
              ))}
            </div>

            <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-gold/60 uppercase tracking-widest">Staff Passwords</p>
                <button onClick={() => setShowPasswords(!showPasswords)} className="text-white/30 hover:text-gold transition-colors">
                  {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {[
                { label: 'Manager Password', key: 'manager_password' },
                { label: 'Receptionist Password', key: 'receptionist_password' },
                { label: 'Housekeeping Password', key: 'housekeeping_password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-white/40 mb-1.5 block">{f.label}</label>
                  <input type={showPasswords ? 'text' : 'password'}
                    value={(settingsForm as any)[f.key] || ''}
                    onChange={e => setSettingsForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-gold/40 transition-all"
                  />
                </div>
              ))}
            </div>

            <button onClick={saveSettings} disabled={savingSettings}
              className="w-full py-3.5 bg-gold hover:bg-gold-light disabled:opacity-50 text-lodge font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
              <Save size={15} />
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>

      {/* ── ROOM FORM MODAL ── */}
      {showRoomForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-lodge-surface border border-lodge-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl italic text-white">
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </h3>
              <button onClick={() => setShowRoomForm(false)} className="text-white/30 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Room Name', key: 'name', type: 'text', ph: 'e.g. Room 101' },
                { label: 'Price Per Night (₦)', key: 'price_per_night', type: 'number', ph: '15000' },
                { label: 'Floor', key: 'floor', type: 'number', ph: '1' },
                { label: 'Max Guests', key: 'max_guests', type: 'number', ph: '2' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-white/40 mb-1.5 block">{f.label}</label>
                  <input type={f.type} placeholder={f.ph}
                    value={(roomForm as any)[f.key]}
                    onChange={e => setRoomForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Room Type</label>
                <select value={roomForm.type}
                  onChange={e => setRoomForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 capitalize">
                  {ROOM_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Amenities (comma separated)</label>
                <input type="text" placeholder="WiFi, AC, TV, Bathroom..."
                  value={roomForm.amenities}
                  onChange={e => setRoomForm(prev => ({ ...prev, amenities: e.target.value }))}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Description</label>
                <textarea rows={3} placeholder="Brief description of the room..."
                  value={roomForm.description}
                  onChange={e => setRoomForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveRoom}
                  className="flex-1 py-3 bg-gold hover:bg-gold-light text-lodge font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  <Save size={14} /> {editingRoom ? 'Save Changes' : 'Add Room'}
                </button>
                <button onClick={() => setShowRoomForm(false)}
                  className="px-6 py-3 bg-lodge-card border border-lodge-border text-white/50 hover:text-white rounded-xl text-sm transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
