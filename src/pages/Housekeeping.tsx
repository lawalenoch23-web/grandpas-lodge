import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { HousekeepingTask, MaintenanceReport, Room } from '../lib/types'
import {
  LogOut, CheckCircle, Clock, AlertTriangle,
  Wrench, MessageSquare, X, ChevronDown, ChevronUp
} from 'lucide-react'

type Tab = 'cleaning' | 'maintenance'

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

export default function Housekeeping() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('cleaning')
  const [tasks, setTasks] = useState<HousekeepingTask[]>([])
  const [reports, setReports] = useState<MaintenanceReport[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [hotelName, setHotelName] = useState("Grandpa's Lodge")
  const [loading, setLoading] = useState(true)
  const [expandedTask, setExpandedTask] = useState<number | null>(null)

  // Report issue form
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportRoom, setReportRoom] = useState('')
  const [reportIssue, setReportIssue] = useState('')
  const [savingReport, setSavingReport] = useState(false)

  // Auth
  useEffect(() => {
    const session = localStorage.getItem('lodge_housekeeping_session')
    if (!session) { navigate('/login'); return }
    const { time } = JSON.parse(session)
    if (Date.now() - time > 12 * 60 * 60 * 1000) {
      localStorage.removeItem('lodge_housekeeping_session'); navigate('/login'); return
    }
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAll = async () => {
    const [tasksRes, reportsRes, roomsRes, settingsRes] = await Promise.all([
      supabase.from('housekeeping_tasks').select('*, room:rooms(*)').order('created_at', { ascending: false }),
      supabase.from('maintenance_reports').select('*, room:rooms(*)').order('created_at', { ascending: false }),
      supabase.from('rooms').select('*').order('name'),
      supabase.from('hotel_settings').select('hotel_name').single(),
    ])
    if (tasksRes.data) setTasks(tasksRes.data as any)
    if (reportsRes.data) setReports(reportsRes.data as any)
    if (roomsRes.data) setRooms(roomsRes.data)
    if (settingsRes.data) setHotelName(settingsRes.data.hotel_name)
    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('lodge_housekeeping_session')
    navigate('/login')
  }

  // ── Mark task done ─────────────────────────────────────
  const markTaskDone = async (task: HousekeepingTask) => {
    try {
      await supabase.from('housekeeping_tasks').update({ status: 'done' }).eq('id', task.id)
      // Mark room as available
      await supabase.from('rooms').update({ status: 'available' }).eq('id', task.room_id)
      await fetchAll()
    } catch (e: any) {
      alert('Failed: ' + e.message)
    }
  }

  // ── Mark task in progress ──────────────────────────────
  const markInProgress = async (taskId: number) => {
    await supabase.from('housekeeping_tasks').update({ status: 'in_progress' }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in_progress' } : t))
  }

  // ── Report maintenance issue ───────────────────────────
  const submitReport = async () => {
    if (!reportRoom || !reportIssue.trim()) { alert('Please select a room and describe the issue'); return }
    setSavingReport(true)
    try {
      const room = rooms.find(r => String(r.id) === reportRoom)
      await supabase.from('maintenance_reports').insert({
        room_id: parseInt(reportRoom), issue: reportIssue, status: 'open'
      })
      // Mark room as maintenance
      await supabase.from('rooms').update({ status: 'maintenance' }).eq('id', parseInt(reportRoom))
      setShowReportForm(false)
      setReportRoom('')
      setReportIssue('')
      await fetchAll()
      alert(`✅ Maintenance reported for ${room?.name}. Room marked as under maintenance.`)
    } catch (e: any) {
      alert('Failed: ' + e.message)
    } finally {
      setSavingReport(false)
    }
  }

  // ── Update maintenance status ──────────────────────────
  const updateMaintenanceStatus = async (reportId: number, status: string, roomId: number) => {
    await supabase.from('maintenance_reports').update({ status }).eq('id', reportId)
    if (status === 'resolved') {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', roomId)
    }
    await fetchAll()
  }

  // ── Computed ───────────────────────────────────────────
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const openReports = reports.filter(r => r.status !== 'resolved')
  const resolvedReports = reports.filter(r => r.status === 'resolved')

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
              <span className="text-sm">🧹</span>
            </div>
            <div>
              <p className="font-display text-base italic leading-none">{hotelName}</p>
              <p className="text-[9px] font-mono text-gold/50 uppercase tracking-widest">Housekeeping</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {[
              { label: 'Pending', val: pendingTasks.length, color: 'text-amber-400' },
              { label: 'In Progress', val: inProgressTasks.length, color: 'text-blue-400' },
              { label: 'Done Today', val: doneTasks.length, color: 'text-emerald-400' },
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
            { id: 'cleaning', icon: '🧹', label: `Cleaning (${pendingTasks.length + inProgressTasks.length})` },
            { id: 'maintenance', icon: '🔧', label: `Maintenance (${openReports.length})` },
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
          { label: 'Pending', val: pendingTasks.length, color: 'text-amber-400' },
          { label: 'In Progress', val: inProgressTasks.length, color: 'text-blue-400' },
          { label: 'Done', val: doneTasks.length, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-lodge-card border border-lodge-border rounded-xl p-2 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-[9px] text-white/30 uppercase font-mono">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto w-full">

        {/* ── CLEANING TAB ── */}
        {tab === 'cleaning' && (
          <div className="space-y-4 animate-fade-up">

            {/* Pending tasks */}
            {pendingTasks.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Clock size={11} /> Needs Cleaning ({pendingTasks.length})
                </p>
                <div className="space-y-3">
                  {pendingTasks.map(task => {
                    const room = (task as any).room
                    return (
                      <div key={task.id} className="bg-lodge-surface border border-amber-500/20 rounded-2xl overflow-hidden">
                        <div className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-amber-400 text-lg">🛏️</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white">{room?.name || `Room ${task.room_id}`}</p>
                            <p className="text-xs text-white/40 capitalize">{room?.type} · Floor {room?.floor}</p>
                            {task.notes && <p className="text-xs text-amber-400/70 mt-0.5 truncate">{task.notes}</p>}
                          </div>
                          <p className="text-[10px] text-white/30 font-mono flex-shrink-0">
                            {fmtTime(task.created_at)}
                          </p>
                        </div>
                        <div className="px-4 pb-4 flex gap-2">
                          <button onClick={() => markInProgress(task.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-medium transition-all active:scale-95">
                            <Clock size={12} /> Start Cleaning
                          </button>
                          <button onClick={() => markTaskDone(task)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-medium transition-all active:scale-95">
                            <CheckCircle size={12} /> Mark Clean ✓
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* In progress */}
            {inProgressTasks.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-blue-400/70 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Clock size={11} /> Currently Cleaning ({inProgressTasks.length})
                </p>
                <div className="space-y-3">
                  {inProgressTasks.map(task => {
                    const room = (task as any).room
                    return (
                      <div key={task.id} className="bg-lodge-surface border border-blue-500/20 rounded-2xl overflow-hidden">
                        <div className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-400 text-lg animate-pulse">🧹</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white">{room?.name || `Room ${task.room_id}`}</p>
                            <p className="text-xs text-blue-400">In progress...</p>
                            {task.notes && <p className="text-xs text-white/30 mt-0.5">{task.notes}</p>}
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                          <button onClick={() => markTaskDone(task)}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-semibold transition-all active:scale-95">
                            <CheckCircle size={15} /> Done — Room is Clean ✓
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {pendingTasks.length === 0 && inProgressTasks.length === 0 && (
              <div className="text-center py-16 text-white/20">
                <span className="text-5xl block mb-4">✨</span>
                <p className="font-display text-2xl italic text-white/30 mb-2">All rooms clean!</p>
                <p className="text-sm">No cleaning tasks right now</p>
              </div>
            )}

            {/* Done tasks today */}
            {doneTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-lodge-border" />
                  <p className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest whitespace-nowrap">
                    ✅ Completed ({doneTasks.length})
                  </p>
                  <div className="flex-1 h-px bg-lodge-border" />
                </div>
                <div className="space-y-2">
                  {doneTasks.map(task => {
                    const room = (task as any).room
                    return (
                      <div key={task.id} className="flex items-center gap-3 px-4 py-3 bg-lodge-surface border border-lodge-border rounded-xl opacity-60">
                        <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{room?.name}</p>
                          {task.notes && <p className="text-xs text-white/30 truncate">{task.notes}</p>}
                        </div>
                        <p className="text-[10px] text-white/30 font-mono">{fmtTime(task.created_at)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MAINTENANCE TAB ── */}
        {tab === 'maintenance' && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl italic text-white">Maintenance Reports</h2>
              <button onClick={() => setShowReportForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gold hover:bg-gold-light text-lodge rounded-xl text-xs font-semibold transition-all">
                <AlertTriangle size={12} /> Report Issue
              </button>
            </div>

            {/* Open reports */}
            {openReports.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-mono text-red-400/70 uppercase tracking-widest flex items-center gap-2">
                  <Wrench size={11} /> Open Issues ({openReports.length})
                </p>
                {openReports.map(report => {
                  const room = (report as any).room
                  const isExpanded = expandedTask === report.id
                  return (
                    <div key={report.id} className="bg-lodge-surface border border-red-500/20 rounded-2xl overflow-hidden">
                      <div className="p-4 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : report.id)}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                            <Wrench size={16} className="text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white">{room?.name || `Room ${report.room_id}`}</p>
                            <p className="text-sm text-red-300 mt-0.5">{report.issue}</p>
                            <p className="text-[10px] text-white/30 mt-1 font-mono">{fmtDate(report.created_at)} · {fmtTime(report.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${
                              report.status === 'open'
                                ? 'text-red-400 border-red-500/20 bg-red-500/10'
                                : 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                            }`}>{report.status.replace('_', ' ')}</span>
                            {isExpanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-lodge-border px-4 pb-4 pt-3 flex gap-2">
                          {report.status === 'open' && (
                            <button onClick={() => updateMaintenanceStatus(report.id, 'in_progress', report.room_id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-medium transition-all">
                              <Clock size={12} /> Mark In Progress
                            </button>
                          )}
                          <button onClick={() => updateMaintenanceStatus(report.id, 'resolved', report.room_id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-medium transition-all">
                            <CheckCircle size={12} /> Mark Resolved ✓
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-white/20">
                <Wrench size={40} className="mx-auto mb-4 opacity-20" />
                <p className="font-display text-xl italic mb-1">No open issues</p>
                <p className="text-sm">Everything is working fine</p>
              </div>
            )}

            {/* Resolved reports */}
            {resolvedReports.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-lodge-border" />
                  <p className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest whitespace-nowrap">
                    ✅ Resolved ({resolvedReports.length})
                  </p>
                  <div className="flex-1 h-px bg-lodge-border" />
                </div>
                <div className="space-y-2">
                  {resolvedReports.slice(0, 5).map(report => {
                    const room = (report as any).room
                    return (
                      <div key={report.id} className="flex items-center gap-3 px-4 py-3 bg-lodge-surface border border-lodge-border rounded-xl opacity-50">
                        <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{room?.name}</p>
                          <p className="text-xs text-white/40 truncate">{report.issue}</p>
                        </div>
                        <p className="text-[10px] text-white/30 font-mono flex-shrink-0">{fmtDate(report.created_at)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── REPORT ISSUE MODAL ── */}
      {showReportForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-lodge-surface border border-lodge-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-lodge-border">
              <h3 className="font-display text-xl italic text-white">Report Maintenance Issue</h3>
              <button onClick={() => setShowReportForm(false)} className="text-white/30 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Room</label>
                <select value={reportRoom} onChange={e => setReportRoom(e.target.value)}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all">
                  <option value="">Select room...</option>
                  {rooms.map(r => (
                    <option key={r.id} value={String(r.id)}>{r.name} ({r.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Describe the Issue</label>
                <textarea rows={4}
                  placeholder="e.g. AC not cooling, tap is leaking, TV remote missing, toilet flush broken..."
                  value={reportIssue} onChange={e => setReportIssue(e.target.value)}
                  className="w-full bg-lodge-card border border-lodge-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/40 transition-all resize-none"
                />
              </div>
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                <p className="text-xs text-amber-400">
                  ⚠️ Reporting this will mark the room as "Under Maintenance" so no new guests are checked in.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={submitReport} disabled={savingReport}
                  className="flex-1 py-3 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  <AlertTriangle size={14} />
                  {savingReport ? 'Reporting...' : 'Submit Report'}
                </button>
                <button onClick={() => setShowReportForm(false)}
                  className="px-5 py-3 bg-lodge-card border border-lodge-border text-white/50 rounded-xl text-sm transition-all">
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
