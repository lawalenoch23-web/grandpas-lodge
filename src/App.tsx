import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Manager from './pages/Manager'
import Receptionist from './pages/Receptionist'
import Housekeeping from './pages/Housekeeping'
import BookingTrack from './pages/BookingTrack'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/manager" element={<Manager />} />
      <Route path="/receptionist" element={<Receptionist />} />
      <Route path="/housekeeping" element={<Housekeeping />} />
      <Route path="/track/:bookingId" element={<BookingTrack />} />
    </Routes>
  )
}
