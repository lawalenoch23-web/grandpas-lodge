import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
export default function Housekeeping() {
  const navigate = useNavigate()
  useEffect(() => {
    const s = localStorage.getItem('lodge_housekeeping_session')
    if (!s) navigate('/login')
  }, [])
  return (
    <div className="min-h-screen bg-lodge flex items-center justify-center">
      <div className="text-center">
        <p className="font-display text-4xl italic text-gold mb-2">Housekeeping Portal</p>
        <p className="text-white/40 text-sm">Coming in Session 2 🧹</p>
      </div>
    </div>
  )
}
