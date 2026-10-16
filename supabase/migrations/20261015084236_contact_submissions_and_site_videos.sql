-- Applied to AMR (khucmrlbstdlbxcuboub). Contact form + site video CMS hooks.

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  company text check (company is null or char_length(company) <= 200),
  message text not null check (char_length(message) between 1 and 5000),
  subject text check (subject is null or char_length(subject) <= 200),
  source text check (source is null or char_length(source) <= 100),
  page_url text check (page_url is null or char_length(page_url) <= 2048),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512)
);

alter table public.contact_submissions enable row level security;

create policy contact_submissions_anon_insert
  on public.contact_submissions
  for insert
  to anon, authenticated
  with check (true);

create table public.site_videos (
  id text primary key,
  kind text not null check (kind in ('file', 'youtube', 'vimeo')),
  title text not null,
  description text,
  duration_sec integer check (duration_sec is null or duration_sec > 0),
  youtube_id text,
  vimeo_id text,
  poster_url text,
  sources jsonb,
  captions jsonb,
  transcript_url text,
  width integer,
  height integer,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint site_videos_kind_ids check (
    (kind = 'youtube' and youtube_id is not null and vimeo_id is null)
    or (kind = 'vimeo' and vimeo_id is not null and youtube_id is null)
    or (kind = 'file' and youtube_id is null and vimeo_id is null and sources is not null)
  )
);

alter table public.site_videos enable row level security;

create policy site_videos_public_read_published
  on public.site_videos
  for select
  to anon, authenticated
  using (published = true);

insert into public.site_videos (id, kind, title, description, youtube_id, published)
values (
  'simulation',
  'youtube',
  'AMR4 mapping run (simulation)',
  'A full run in simulation: the robot drives the apartment and builds its map, room by room.',
  'REPLACE_WITH_YOUTUBE_ID',
  false
);
