// Receptionist portal stub — full build in Session 2
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
export default function Receptionist() {
  const navigate = useNavigate()
  useEffect(() => {
    const s = localStorage.getItem('lodge_receptionist_session')
    if (!s) navigate('/login')
  }, [])
  return (
    <div className="min-h-screen bg-lodge flex items-center justify-center">
      <div className="text-center">
        <p className="font-display text-4xl italic text-gold mb-2">Receptionist Portal</p>
        <p className="text-white/40 text-sm">Coming in Session 2 🏨</p>
      </div>
    </div>
  )
}
