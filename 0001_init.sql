-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  airline text not null,
  flight_number text not null,
  travel_date date not null,
  departure_time time not null,
  duration_hours numeric not null default 2,
  status text not null default 'ontime' check (status in ('ontime','delayed','cancelled')),
  entered_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table trips enable row level security;

-- Any logged-in staff member can read and write trips
create policy "staff can read trips"
  on trips for select
  to authenticated
  using (true);

create policy "staff can insert trips"
  on trips for insert
  to authenticated
  with check (true);

create policy "staff can update trips"
  on trips for update
  to authenticated
  using (true);

create policy "staff can delete trips"
  on trips for delete
  to authenticated
  using (true);

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trips_set_updated_at
  before update on trips
  for each row execute function set_updated_at();
