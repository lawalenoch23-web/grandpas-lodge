-- ════════════════════════════════════════════════════════
-- GRANDPA'S LODGE — BASE SCHEMA
-- Run this in your Supabase SQL Editor to set up the DB
-- ════════════════════════════════════════════════════════

-- 1. Rooms
create table if not exists rooms (
  id bigserial primary key,
  name text not null,
  type text not null default 'standard',
  floor integer default 1,
  price_per_night numeric not null default 0,
  max_guests integer default 2,
  amenities text[] default '{}',
  images text[] default '{}',
  status text not null default 'available',
  is_active boolean default true,
  description text,
  created_at timestamptz default now()
);

-- 2. Bookings
create table if not exists bookings (
  id bigserial primary key,
  customer_name text not null,
  phone text not null,
  email text,
  room_id bigint references rooms(id),
  check_in date not null,
  check_out date not null,
  nights integer not null default 1,
  total_price numeric not null default 0,
  amount_paid numeric not null default 0,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  payment_method text default 'cash',
  booking_source text default 'walkin',
  special_requests text,
  id_type text,
  id_number text,
  notes text,
  created_at timestamptz default now()
);

-- 3. Hotel Settings (single row)
create table if not exists hotel_settings (
  id bigserial primary key,
  hotel_name text not null default 'My Hotel',
  logo_url text,
  primary_color text default '#C9A84C',
  secondary_color text default '#0D0B08',
  background_color text default '#0D0B08',
  bank_name text,
  account_number text,
  account_name text,
  whatsapp_number text,
  instagram_url text,
  address text,
  city text,
  check_in_time text default '14:00',
  check_out_time text default '12:00',
  manager_password text not null default 'manager123',
  receptionist_password text not null default 'receptionist123',
  housekeeping_password text not null default 'housekeeping123',
  paystack_public_key text,
  announcement_message text,
  show_announcement boolean default false
);

-- 4. Housekeeping Tasks
create table if not exists housekeeping_tasks (
  id bigserial primary key,
  room_id bigint references rooms(id),
  status text not null default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- 5. Maintenance Reports
create table if not exists maintenance_reports (
  id bigserial primary key,
  room_id bigint references rooms(id),
  issue text not null,
  status text not null default 'open',
  created_at timestamptz default now()
);

-- 6. Discounts / Promo Codes
create table if not exists discounts (
  id bigserial primary key,
  code text not null unique,
  percentage numeric not null default 10,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ════════════════════════════════════════════════════════
-- INSERT DEFAULT HOTEL SETTINGS (run after tables created)
-- Edit the values to match the hotel
-- ════════════════════════════════════════════════════════
insert into hotel_settings (
  hotel_name, primary_color, secondary_color, background_color,
  manager_password, receptionist_password, housekeeping_password,
  check_in_time, check_out_time
) values (
  'My Hotel', '#C9A84C', '#0D0B08', '#0D0B08',
  'manager123', 'receptionist123', 'housekeeping123',
  '14:00', '12:00'
);

-- ════════════════════════════════════════════════════════
-- SAMPLE ROOMS (optional — delete if not needed)
-- ════════════════════════════════════════════════════════
insert into rooms (name, type, floor, price_per_night, max_guests, amenities, status, description) values
  ('Room 101', 'standard', 1, 15000, 2, '{"WiFi","AC","TV","Bathroom"}', 'available', 'Cozy standard room with garden view'),
  ('Room 102', 'standard', 1, 15000, 2, '{"WiFi","AC","TV","Bathroom"}', 'available', 'Cozy standard room with garden view'),
  ('Room 201', 'deluxe', 2, 25000, 2, '{"WiFi","AC","TV","Bathroom","Mini Fridge","Balcony"}', 'available', 'Spacious deluxe room with city view'),
  ('Room 202', 'deluxe', 2, 25000, 3, '{"WiFi","AC","TV","Bathroom","Mini Fridge","Balcony"}', 'available', 'Spacious deluxe room with city view'),
  ('Suite 301', 'suite', 3, 50000, 4, '{"WiFi","AC","TV","Bathroom","Kitchen","Living Room","Balcony"}', 'available', 'Luxury suite with panoramic views');
