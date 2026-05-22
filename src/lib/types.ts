export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved'
export type RoomType = 'standard' | 'deluxe' | 'suite' | 'executive' | 'presidential'
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'paystack'
export type BookingSource = 'online' | 'walkin' | 'phone' | 'agent'

export interface Room {
  id: number
  name: string
  type: RoomType
  floor: number
  price_per_night: number
  max_guests: number
  amenities: string[]
  images: string[]
  status: RoomStatus
  is_active: boolean
  description: string
  created_at: string
}

export interface Booking {
  id: number
  customer_name: string
  phone: string
  email: string | null
  room_id: number
  room?: Room
  check_in: string
  check_out: string
  nights: number
  total_price: number
  amount_paid: number
  status: BookingStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  booking_source: BookingSource
  special_requests: string | null
  id_type: string | null
  id_number: string | null
  notes: string | null
  created_at: string
}

export interface HotelSettings {
  id: number
  hotel_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  background_color: string
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  whatsapp_number: string | null
  instagram_url: string | null
  address: string | null
  city: string | null
  check_in_time: string
  check_out_time: string
  manager_password: string
  receptionist_password: string
  housekeeping_password: string
  paystack_public_key: string | null
  announcement_message: string | null
  show_announcement: boolean
}

export interface HousekeepingTask {
  id: number
  room_id: number
  room?: Room
  status: 'pending' | 'in_progress' | 'done'
  notes: string | null
  created_at: string
}

export interface MaintenanceReport {
  id: number
  room_id: number
  room?: Room
  issue: string
  status: 'open' | 'in_progress' | 'resolved'
  created_at: string
}
