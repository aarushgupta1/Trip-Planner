-- Run this in your Supabase project's SQL Editor. Safe to re-run in full any
-- time this file changes — every statement is idempotent: tables/columns use
-- IF NOT EXISTS, policies are dropped before being recreated (Postgres has
-- no CREATE POLICY IF NOT EXISTS), and adding a table to the realtime
-- publication is wrapped to ignore "already a member" errors (no ADD TABLE
-- IF NOT EXISTS for publications either).

create table if not exists attractions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  category     text not null default 'other'
               check (category in ('museum', 'food', 'landmark', 'entertainment', 'flights', 'travel', 'other')),
  scheduled_date date,
  start_time   time,
  end_time     time,
  notes        text,
  location     text,
  lat          double precision,
  lng          double precision,
  created_at   timestamptz default now()
);

-- Safe to re-run on an existing table: adds the location/travel-time columns
-- (geocoded from the "location" address text) if they aren't there yet.
alter table attractions add column if not exists location text;
alter table attractions add column if not exists lat double precision;
alter table attractions add column if not exists lng double precision;

-- Free-text hours/days-open info for the place, entered by hand (not
-- geocoded or validated) — e.g. "9:00 AM – 5:00 PM" and "Tue–Sun (closed
-- Mondays)".
alter table attractions add column if not exists opening_hours text;
alter table attractions add column if not exists open_days text;

-- "flights" and "travel" were added as categories, and later "palace",
-- "cathedral", and "tour" too — the CREATE TABLE above only applies to a
-- brand-new table, so existing databases need their check constraint
-- widened explicitly to actually accept them. "museum" and "food" are no
-- longer offered as choices in the app's category picker, but are left in
-- this constraint so any existing rows already using them stay valid.
alter table attractions drop constraint if exists attractions_category_check;
alter table attractions add constraint attractions_category_check
  check (category in ('museum', 'food', 'landmark', 'palace', 'cathedral', 'tour', 'entertainment', 'flights', 'travel', 'other',
                      'slopes', 'lesson', 'rental', 'apres', 'beach', 'water', 'boat', 'spa'));


-- Uploaded ticket files (images/PDFs), stored as public URLs into the
-- "tickets" storage bucket set up below.
alter table attractions add column if not exists ticket_urls text[] not null default '{}';

-- The per-event checkmark feature was removed — drops the column from any
-- database that still has it from before. Safe to re-run either way.
alter table attractions drop column if exists is_checked;

-- Attribution: the self-chosen display name of whoever last created/edited
-- this row, and when — shown as "last edited by ___" in the edit modal.
-- There's no auth in this app, so this is just a label passed along with
-- each write from the browser's local storage; nothing here is verified.
alter table attractions add column if not exists edited_by text;
alter table attractions add column if not exists updated_at timestamptz default now();

-- Superseded by separate departure/arrival timezone columns below (a flight's
-- two ends are naturally in two different zones, so one flag for the whole
-- event wasn't enough). Safe to re-run either way.
alter table attractions drop column if exists pin_eastern;

-- For flights: which zone the departure and arrival times each display in
-- (e.g. an ET departure landing in CEST Vienna). Ignored for non-flight
-- categories; both default to 'vienna' like every other event.
-- Values are 'local' (the trip destination's time) or 'home' (the trip's
-- home timezone, set per trip). Older databases stored 'vienna'/'eastern'
-- here — those rows are converted below before the new check is applied.
alter table attractions add column if not exists departure_timezone text not null default 'local';
alter table attractions add column if not exists arrival_timezone text not null default 'local';
alter table attractions drop constraint if exists attractions_departure_timezone_check;
alter table attractions drop constraint if exists attractions_arrival_timezone_check;
update attractions set
  departure_timezone = case departure_timezone when 'vienna' then 'local' when 'eastern' then 'home' else departure_timezone end,
  arrival_timezone   = case arrival_timezone   when 'vienna' then 'local' when 'eastern' then 'home' else arrival_timezone   end
where departure_timezone in ('vienna', 'eastern') or arrival_timezone in ('vienna', 'eastern');
alter table attractions alter column departure_timezone set default 'local';
alter table attractions alter column arrival_timezone set default 'local';
alter table attractions add constraint attractions_departure_timezone_check
  check (departure_timezone in ('local', 'home'));
alter table attractions add constraint attractions_arrival_timezone_check
  check (arrival_timezone in ('local', 'home'));

-- Enable Row Level Security
alter table attractions enable row level security;

-- Allow full public access (no auth — shared family app)
drop policy if exists "public_select" on attractions;
drop policy if exists "public_insert" on attractions;
drop policy if exists "public_update" on attractions;
drop policy if exists "public_delete" on attractions;
create policy "public_select" on attractions for select using (true);
create policy "public_insert" on attractions for insert with check (true);
create policy "public_update" on attractions for update using (true);
create policy "public_delete" on attractions for delete using (true);

-- Enable Realtime (run once; also toggle the table on in the Supabase dashboard → Database → Replication)
alter table attractions replica identity full;
do $$ begin
  alter publication supabase_realtime add table attractions;
exception when duplicate_object then null; -- already added — fine on a re-run
end $$;

-- Storage bucket for uploaded ticket files (images/PDFs), public read like
-- the rest of this no-auth family app.
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', true)
on conflict (id) do nothing;

drop policy if exists "public_read_tickets" on storage.objects;
drop policy if exists "public_insert_tickets" on storage.objects;
drop policy if exists "public_delete_tickets" on storage.objects;
create policy "public_read_tickets" on storage.objects for select using (bucket_id = 'tickets');
create policy "public_insert_tickets" on storage.objects for insert with check (bucket_id = 'tickets');
create policy "public_delete_tickets" on storage.objects for delete using (bucket_id = 'tickets');

-- The logistics pinboard (flights/accommodation/transport/documents/contacts/
-- budget pins) was removed in favor of the calendar's own "flights" category
-- and the dedicated hotels list below — drops the table entirely. Safe to
-- re-run either way.
drop table if exists logistics_pins;

-- Hotels. Multiple stays are supported (e.g. switching hotels partway
-- through the trip) — each is its own row, listed and managed from the
-- sidebar that used to show unscheduled attractions.
create table if not exists hotels (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  location            text,
  lat                 double precision,
  lng                 double precision,
  check_in            date,
  check_out           date,
  price               numeric,
  currency            text not null default 'EUR' check (currency in ('EUR', 'USD', 'CZK')),
  confirmation_number text,
  notes               text,
  created_at          timestamptz default now()
);

-- Same "last edited by ___" attribution as attractions (see comment above).
alter table hotels add column if not exists edited_by text;
alter table hotels add column if not exists updated_at timestamptz default now();

-- Specific trip days (YYYY-MM-DD strings) this hotel is flagged for, shown
-- as a badge on the calendar day header and used to find "the" hotel for an
-- event's day when computing distance/directions. Deliberately not
-- constrained to be contiguous or unique per day — a stay can cover a
-- non-contiguous subset of days, and more than one hotel can be assigned to
-- the same day (comparing options, a mid-stay switch, etc.). Defaults to
-- empty, in which case the app falls back to the check_in–check_out range.
alter table hotels add column if not exists assigned_dates text[] not null default '{}';

-- Any ISO-style 3-letter currency code is allowed (trips can be anywhere) —
-- the inline check above only applies on first create, so existing tables
-- need the constraint replaced explicitly.
alter table hotels drop constraint if exists hotels_currency_check;
alter table hotels add constraint hotels_currency_check check (currency ~ '^[A-Z]{3}$');

alter table hotels enable row level security;

drop policy if exists "public_select" on hotels;
drop policy if exists "public_insert" on hotels;
drop policy if exists "public_update" on hotels;
drop policy if exists "public_delete" on hotels;
create policy "public_select" on hotels for select using (true);
create policy "public_insert" on hotels for insert with check (true);
create policy "public_update" on hotels for update using (true);
create policy "public_delete" on hotels for delete using (true);

-- Enable Realtime (run once; also toggle the table on in the Supabase dashboard → Database → Replication)
alter table hotels replica identity full;
do $$ begin
  alter publication supabase_realtime add table hotels;
exception when duplicate_object then null; -- already added — fine on a re-run
end $$;

-- Per-day notes on the calendar (previously localStorage-only, so they
-- didn't sync across devices).
create table if not exists day_notes (
  date       date primary key,
  note       text not null default '',
  updated_at timestamptz default now()
);

-- Same "last edited by ___" attribution as attractions/hotels (not currently
-- surfaced in the UI for day notes, just recorded for later use).
alter table day_notes add column if not exists edited_by text;

alter table day_notes enable row level security;

drop policy if exists "public_select" on day_notes;
drop policy if exists "public_insert" on day_notes;
drop policy if exists "public_update" on day_notes;
drop policy if exists "public_delete" on day_notes;
create policy "public_select" on day_notes for select using (true);
create policy "public_insert" on day_notes for insert with check (true);
create policy "public_update" on day_notes for update using (true);
create policy "public_delete" on day_notes for delete using (true);

-- Enable Realtime (run once; also toggle the table on in the Supabase dashboard → Database → Replication)
alter table day_notes replica identity full;
do $$ begin
  alter publication supabase_realtime add table day_notes;
exception when duplicate_object then null; -- already added — fine on a re-run
end $$;

-- Event reminders (Web Push). Each device that enables notifications stores
-- one subscription here; the /api/send-event-reminders endpoint (triggered
-- by a cron job — see supabase/reminders_cron.sql) reads all of them and
-- pushes a "starts in 30 min" notification to every device at once. No
-- realtime needed — these tables are only ever read/written server-side or
-- written once by the subscribing device itself.
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "public_select" on push_subscriptions;
drop policy if exists "public_insert" on push_subscriptions;
drop policy if exists "public_update" on push_subscriptions;
drop policy if exists "public_delete" on push_subscriptions;
create policy "public_select" on push_subscriptions for select using (true);
create policy "public_insert" on push_subscriptions for insert with check (true);
create policy "public_update" on push_subscriptions for update using (true);
create policy "public_delete" on push_subscriptions for delete using (true);

-- Tracks which attractions have already had their 30-minutes-prior reminder
-- sent, so repeated cron runs don't re-notify. Deleted automatically if the
-- attraction is deleted; the app also clears a row here whenever that
-- attraction's day/time changes, so a rescheduled event gets a fresh reminder.
create table if not exists event_reminders_sent (
  attraction_id uuid primary key references attractions(id) on delete cascade,
  sent_at       timestamptz default now()
);

alter table event_reminders_sent enable row level security;

drop policy if exists "public_select" on event_reminders_sent;
drop policy if exists "public_insert" on event_reminders_sent;
drop policy if exists "public_delete" on event_reminders_sent;
create policy "public_select" on event_reminders_sent for select using (true);
create policy "public_insert" on event_reminders_sent for insert with check (true);
create policy "public_delete" on event_reminders_sent for delete using (true);

-- The trip chatbot feature (and its daily-message-cap table) was removed.
-- Drops the table from any database that already ran the earlier version of
-- this file. Safe to re-run either way.
drop table if exists chat_usage;

-- =====================================================================
-- Accounts & multiple trips
--
-- Everything above started as a single shared trip with open (no-login)
-- access. From here on each trip belongs to one signed-in user (Supabase
-- Auth), and every event / hotel / day note belongs to a trip. Row Level
-- Security below makes each user's data visible only to them — the old
-- "public_*" open policies are dropped at the end of this section.
-- Safe to re-run in full, like the rest of this file.
-- =====================================================================

create table if not exists trips (
  id            uuid primary key default gen_random_uuid(),
  -- null only for the one pre-existing trip migrated below, until its
  -- owner claims it (see claim_legacy_trip at the bottom)
  owner_id      uuid references auth.users(id) on delete cascade,
  name          text not null,
  start_date    date not null,
  end_date      date not null check (end_date >= start_date),
  -- The destination's IANA timezone (the first stop's) — the calendar grid
  -- shows events in this zone, and "today"/reminders are computed in it.
  timezone      text not null default 'UTC',
  -- Where the travelers live — flights can show times in this zone too.
  home_timezone text not null default 'America/New_York',
  created_at    timestamptz default now()
);

-- Kind of vacation (sightseeing / ski / beach) — decides which event
-- categories the trip offers. Existing trips stay sightseeing.
alter table trips add column if not exists trip_type text not null default 'sightseeing';
alter table trips drop constraint if exists trips_trip_type_check;
alter table trips add constraint trips_trip_type_check check (trip_type in ('sightseeing', 'ski', 'beach'));

-- One row per stop. A city can appear more than once and ranges can overlap
-- (e.g. a day trip from one base city to another), same as before.
create table if not exists trip_cities (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  name         text not null,
  country      text not null default '',
  country_code text not null default '',
  lat          double precision not null,
  lng          double precision not null,
  timezone     text not null default 'UTC',
  start_date   date not null,
  end_date     date not null check (end_date >= start_date),
  position     integer not null default 0
);
create index if not exists trip_cities_trip_id_idx on trip_cities (trip_id);

alter table attractions add column if not exists trip_id uuid references trips(id) on delete cascade;
alter table hotels      add column if not exists trip_id uuid references trips(id) on delete cascade;
alter table day_notes   add column if not exists trip_id uuid references trips(id) on delete cascade;
create index if not exists attractions_trip_id_idx on attractions (trip_id);
create index if not exists hotels_trip_id_idx on hotels (trip_id);

-- Move all pre-existing (single-trip) data into one "legacy" trip so
-- nothing is lost. Only runs if there's actually unassigned data, so a
-- fresh database doesn't get a phantom Vienna trip.
do $$
declare
  legacy uuid := '00000000-0000-0000-0000-000000000001';
begin
  if exists (select 1 from attractions where trip_id is null)
     or exists (select 1 from hotels where trip_id is null)
     or exists (select 1 from day_notes where trip_id is null) then

    insert into trips (id, owner_id, name, start_date, end_date, timezone, home_timezone)
    values (legacy, null, 'Vienna, Salzburg & Prague', '2026-08-06', '2026-08-16', 'Europe/Vienna', 'America/New_York')
    on conflict (id) do nothing;

    if not exists (select 1 from trip_cities where trip_id = legacy) then
      insert into trip_cities (trip_id, name, country, country_code, lat, lng, timezone, start_date, end_date, position) values
        (legacy, 'Vienna',   'Austria',        'AT', 48.2082, 16.3738, 'Europe/Vienna', '2026-08-06', '2026-08-08', 0),
        (legacy, 'Salzburg', 'Austria',        'AT', 47.8095, 13.0550, 'Europe/Vienna', '2026-08-09', '2026-08-11', 1),
        (legacy, 'Prague',   'Czech Republic', 'CZ', 50.0755, 14.4378, 'Europe/Prague', '2026-08-12', '2026-08-16', 2),
        -- Aug 10: day trip back to Vienna while based in Salzburg
        (legacy, 'Vienna',   'Austria',        'AT', 48.2082, 16.3738, 'Europe/Vienna', '2026-08-10', '2026-08-10', 3),
        -- Aug 12: Salzburg checkout day, before arriving in Prague
        (legacy, 'Salzburg', 'Austria',        'AT', 47.8095, 13.0550, 'Europe/Vienna', '2026-08-12', '2026-08-12', 4);
    end if;

    update attractions set trip_id = legacy where trip_id is null;
    update hotels      set trip_id = legacy where trip_id is null;
    update day_notes   set trip_id = legacy where trip_id is null;
  end if;
end $$;

alter table attractions alter column trip_id set not null;
alter table hotels      alter column trip_id set not null;
alter table day_notes   alter column trip_id set not null;

-- A day note is now unique per (trip, date) rather than per date alone.
alter table day_notes drop constraint if exists day_notes_pkey;
alter table day_notes add primary key (trip_id, date);

-- Which device(s) to notify belongs to a user now, not to everyone.
alter table push_subscriptions add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ---- Row Level Security: you see trips you own or were invited to ----

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from trips where id = p_trip and owner_id = auth.uid());
$$;

-- Invited people ("members") can see and edit a trip's events, hotels and
-- notes, but only the owner can change the trip itself, share it or delete it.
create table if not exists trip_members (
  trip_id    uuid not null references trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (trip_id, user_id)
);
create index if not exists trip_members_user_id_idx on trip_members (user_id);

-- One shareable link per trip (anyone signed in who opens it joins).
create table if not exists trip_invites (
  token      text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  trip_id    uuid not null references trips(id) on delete cascade,
  created_at timestamptz default now()
);
create unique index if not exists trip_invites_trip_id_idx on trip_invites (trip_id);

create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from trips where id = p_trip and owner_id = auth.uid())
      or exists (select 1 from trip_members where trip_id = p_trip and user_id = auth.uid());
$$;

alter table trips enable row level security;
alter table trip_cities enable row level security;
alter table trip_members enable row level security;
alter table trip_invites enable row level security;

drop policy if exists "owner_all" on trips;
drop policy if exists "member_select" on trips;
drop policy if exists "owner_insert" on trips;
drop policy if exists "owner_update" on trips;
drop policy if exists "owner_delete" on trips;
create policy "member_select" on trips for select to authenticated
  using (owner_id = auth.uid() or public.is_trip_member(id));
create policy "owner_insert" on trips for insert to authenticated with check (owner_id = auth.uid());
create policy "owner_update" on trips for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_delete" on trips for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "owner_all" on trip_cities;
drop policy if exists "member_select" on trip_cities;
drop policy if exists "owner_write" on trip_cities;
create policy "member_select" on trip_cities for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "owner_write" on trip_cities for all to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- Members are listed for everyone on the trip; the owner can remove anyone,
-- and anyone can remove themselves (leave). Joining goes through join_trip().
drop policy if exists "member_select" on trip_members;
drop policy if exists "owner_or_self_delete" on trip_members;
create policy "member_select" on trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "owner_or_self_delete" on trip_members for delete to authenticated
  using (public.is_trip_owner(trip_id) or user_id = auth.uid());

drop policy if exists "owner_all" on trip_invites;
create policy "owner_all" on trip_invites for all to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- Replace the old open policies on the trip-scoped tables.
drop policy if exists "public_select" on attractions;
drop policy if exists "public_insert" on attractions;
drop policy if exists "public_update" on attractions;
drop policy if exists "public_delete" on attractions;
drop policy if exists "owner_all" on attractions;
drop policy if exists "member_all" on attractions;
drop policy if exists "member_select" on attractions;
drop policy if exists "member_insert" on attractions;
drop policy if exists "member_update" on attractions;
drop policy if exists "member_delete" on attractions;

-- Who made an event and who it's shown to. visible_to null = everyone on the
-- trip (the default, and what every existing event is). Otherwise only the
-- creator and the listed people can see, edit or delete it.
alter table attractions add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();
alter table attractions add column if not exists visible_to uuid[];

create or replace function public.can_see_attraction(p_trip uuid, p_created_by uuid, p_visible_to uuid[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_trip_member(p_trip)
     and (p_visible_to is null
          or p_created_by is null
          or p_created_by = auth.uid()
          or auth.uid() = any(p_visible_to));
$$;

create policy "member_select" on attractions for select to authenticated
  using (public.can_see_attraction(trip_id, created_by, visible_to));
create policy "member_insert" on attractions for insert to authenticated
  with check (public.can_see_attraction(trip_id, created_by, visible_to));
create policy "member_update" on attractions for update to authenticated
  using (public.can_see_attraction(trip_id, created_by, visible_to))
  with check (public.can_see_attraction(trip_id, created_by, visible_to));
create policy "member_delete" on attractions for delete to authenticated
  using (public.can_see_attraction(trip_id, created_by, visible_to));

drop policy if exists "public_select" on hotels;
drop policy if exists "public_insert" on hotels;
drop policy if exists "public_update" on hotels;
drop policy if exists "public_delete" on hotels;
drop policy if exists "owner_all" on hotels;
drop policy if exists "member_all" on hotels;
create policy "member_all" on hotels for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

drop policy if exists "public_select" on day_notes;
drop policy if exists "public_insert" on day_notes;
drop policy if exists "public_update" on day_notes;
drop policy if exists "public_delete" on day_notes;
drop policy if exists "owner_all" on day_notes;
drop policy if exists "member_all" on day_notes;
create policy "member_all" on day_notes for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- Reminder bookkeeping follows the attraction it belongs to. (The reminder
-- endpoint itself uses the service-role key, which bypasses RLS.)
drop policy if exists "public_select" on event_reminders_sent;
drop policy if exists "public_insert" on event_reminders_sent;
drop policy if exists "public_delete" on event_reminders_sent;
drop policy if exists "owner_all" on event_reminders_sent;
drop policy if exists "member_all" on event_reminders_sent;
create policy "member_all" on event_reminders_sent for all to authenticated
  using (exists (select 1 from attractions a where a.id = attraction_id and public.is_trip_member(a.trip_id)))
  with check (exists (select 1 from attractions a where a.id = attraction_id and public.is_trip_member(a.trip_id)));

-- Push subscriptions: a user only sees/removes their own devices.
drop policy if exists "public_select" on push_subscriptions;
drop policy if exists "public_insert" on push_subscriptions;
drop policy if exists "public_update" on push_subscriptions;
drop policy if exists "public_delete" on push_subscriptions;
drop policy if exists "owner_all" on push_subscriptions;
create policy "owner_all" on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Re-registering the same browser under a different account needs to take
-- over the existing row (endpoint is unique), which RLS alone wouldn't allow
-- — so saving goes through this function instead.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language sql security definer
set search_path = public
as $$
  insert into push_subscriptions (endpoint, p256dh, auth, user_id)
  values (p_endpoint, p_p256dh, p_auth, auth.uid())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ---- Sharing helpers ----

-- Where each person starts and ends their trip (their own city). Each person
-- only ever sees and edits their own row.
create table if not exists trip_origins (
  trip_id      uuid not null references trips(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  country      text not null default '',
  country_code text not null default '',
  lat          double precision not null,
  lng          double precision not null,
  timezone     text not null,
  primary key (trip_id, user_id)
);
-- Optional different end of the trip (all null = ends where it started).
alter table trip_origins add column if not exists end_name text;
alter table trip_origins add column if not exists end_country text;
alter table trip_origins add column if not exists end_country_code text;
alter table trip_origins add column if not exists end_lat double precision;
alter table trip_origins add column if not exists end_lng double precision;
alter table trip_origins add column if not exists end_timezone text;
alter table trip_origins enable row level security;
drop policy if exists "own_origin" on trip_origins;
create policy "own_origin" on trip_origins for all to authenticated
  using (user_id = auth.uid() and public.is_trip_member(trip_id))
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

-- Packing lists. Each item belongs to the person who added it. A "shared"
-- item shows up on everyone's list on the trip; everyone ticks it off
-- separately (packing_checks holds each person's own ticks).
create table if not exists packing_items (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  shared     boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists packing_items_trip_idx on packing_items (trip_id);
create table if not exists packing_checks (
  item_id uuid not null references packing_items(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (item_id, user_id)
);
alter table packing_items enable row level security;
alter table packing_checks enable row level security;
drop policy if exists "see_items" on packing_items;
drop policy if exists "add_items" on packing_items;
drop policy if exists "own_items_update" on packing_items;
drop policy if exists "own_items_delete" on packing_items;
create policy "see_items" on packing_items for select to authenticated
  using (public.is_trip_member(trip_id) and (shared or created_by = auth.uid()));
create policy "add_items" on packing_items for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "own_items_update" on packing_items for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid() and public.is_trip_member(trip_id));
create policy "own_items_delete" on packing_items for delete to authenticated
  using (created_by = auth.uid());
drop policy if exists "own_checks" on packing_checks;
create policy "own_checks" on packing_checks for all to authenticated
  using (user_id = auth.uid() and exists (select 1 from packing_items i where i.id = item_id))
  with check (user_id = auth.uid() and exists (select 1 from packing_items i where i.id = item_id));

-- Names of everyone on a trip (owner + members). Names live in auth, which
-- the app can't read directly, so this returns just id + display name (never
-- emails) and only to people already on the trip.
create or replace function public.get_trip_people(p_trip uuid)
returns table (user_id uuid, display_name text, is_owner boolean)
language sql stable security definer
set search_path = public, auth
as $$
  select u.id,
         coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
         (t.owner_id = u.id)
  from trips t
  join auth.users u on u.id = t.owner_id
    or u.id in (select m.user_id from trip_members m where m.trip_id = t.id)
  where t.id = p_trip and public.is_trip_member(p_trip)
  order by (t.owner_id = u.id) desc, 2;
$$;
revoke all on function public.get_trip_people(uuid) from public, anon;
grant execute on function public.get_trip_people(uuid) to authenticated;

-- Everyone on every trip you're on, in one call — for the passengers line on
-- the dashboard tickets. Same rules as get_trip_people: ids and display names
-- only (never emails), and only for trips you belong to.
create or replace function public.get_my_trip_people()
returns table (trip_id uuid, user_id uuid, display_name text, is_owner boolean)
language sql stable security definer
set search_path = public, auth
as $$
  select t.id,
         u.id,
         coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
         (t.owner_id = u.id)
  from trips t
  join auth.users u on u.id = t.owner_id
    or u.id in (select m.user_id from trip_members m where m.trip_id = t.id)
  where public.is_trip_member(t.id)
  order by t.id, (t.owner_id = u.id) desc, 3;
$$;
revoke all on function public.get_my_trip_people() from public, anon;
grant execute on function public.get_my_trip_people() to authenticated;

-- What the invite page shows before someone accepts.
create or replace function public.preview_invite(p_token text)
returns table (trip_name text, owner_name text, already_member boolean)
language sql stable security definer
set search_path = public, auth
as $$
  select t.name,
         coalesce(nullif(trim(o.raw_user_meta_data->>'full_name'), ''), split_part(o.email, '@', 1), 'Someone'),
         public.is_trip_member(t.id)
  from trip_invites i
  join trips t on t.id = i.trip_id
  left join auth.users o on o.id = t.owner_id
  where i.token = p_token;
$$;
revoke all on function public.preview_invite(text) from public, anon;
grant execute on function public.preview_invite(text) to authenticated;

-- Accepting an invite: adds the caller to the trip, returns the trip id
-- (null if the link is no longer valid).
create or replace function public.join_trip(p_token text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  select trip_id into tid from trip_invites where token = p_token;
  if tid is null or auth.uid() is null then
    return null;
  end if;
  insert into trip_members (trip_id, user_id) values (tid, auth.uid())
  on conflict do nothing;
  return tid;
end;
$$;
revoke all on function public.join_trip(text) from public, anon;
grant execute on function public.join_trip(text) to authenticated;

-- ---- AI guide usage limit ----
-- One counter per user per (UTC) day, so a runaway client can't run up the
-- AI bill. No RLS policies on purpose: the table is only reachable through
-- the function below.
create table if not exists guide_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default (now() at time zone 'utc')::date,
  count   integer not null default 0,
  primary key (user_id, day)
);
alter table guide_usage enable row level security;

-- A single counter for everyone together: a ceiling on total daily spend even
-- if someone makes many accounts to get around the per-person limit.
create table if not exists guide_usage_global (
  day   date primary key default (now() at time zone 'utc')::date,
  count integer not null default 0
);
alter table guide_usage_global enable row level security;

-- Counts one guide request. Returns 'ok', or says which limit was hit
-- ('global_limit' = everyone's daily total, 'user_limit' = this person's)
-- and counts nothing in that case. p_global_limit null = no global cap.
-- (The first version of this function took only p_limit and returned a
-- boolean, hence the drop.)
drop function if exists public.bump_guide_usage(integer);
create or replace function public.bump_guide_usage(p_limit integer, p_global_limit integer default null)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  g integer;
  u integer;
begin
  if auth.uid() is null then
    return 'user_limit';
  end if;

  if p_global_limit is not null then
    insert into guide_usage_global (day, count) values (today, 1)
    on conflict (day) do update set count = guide_usage_global.count + 1
      where guide_usage_global.count < p_global_limit
    returning count into g;
    if g is null then
      return 'global_limit';
    end if;
  end if;

  insert into guide_usage (user_id, day, count) values (auth.uid(), today, 1)
  on conflict (user_id, day) do update set count = guide_usage.count + 1
    where guide_usage.count < p_limit
  returning count into u;
  if u is null then
    -- This person is over their own limit: give back the global slot taken above.
    if p_global_limit is not null then
      update guide_usage_global set count = count - 1 where day = today;
    end if;
    return 'user_limit';
  end if;

  return 'ok';
end;
$$;
revoke all on function public.bump_guide_usage(integer, integer) from public, anon;
grant execute on function public.bump_guide_usage(integer, integer) to authenticated;

-- Realtime for the new trip tables isn't needed (they only change from the
-- trips screens); attractions/hotels/day_notes stay published above.

-- ---- Claiming the pre-existing Vienna trip ----
--
-- The migration above parked your original data in a trip with no owner.
-- After you've signed up in the app, run this ONCE in the SQL Editor with
-- the email you signed up with:
--
--   select public.claim_legacy_trip('you@example.com');
--
-- It can only be run from the SQL Editor (not from the app or API), so
-- nobody else who signs up can take the trip.
create or replace function public.claim_legacy_trip(p_email text)
returns text
language plpgsql security definer
set search_path = public, auth
as $$
declare
  uid uuid;
  claimed integer;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    return 'No account with that email yet — sign up in the app first, then run this again.';
  end if;

  update trips set owner_id = uid
  where id = '00000000-0000-0000-0000-000000000001' and owner_id is null;
  get diagnostics claimed = row_count;

  -- Devices that enabled reminders before accounts existed.
  update push_subscriptions set user_id = uid where user_id is null;

  if claimed = 1 then
    return 'Done — the Vienna, Salzburg & Prague trip is now on your account.';
  end if;
  return 'Nothing to claim (already claimed, or there was no earlier data).';
end;
$$;
revoke all on function public.claim_legacy_trip(text) from public, anon, authenticated;
