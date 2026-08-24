-- Base schema reconstruction.
--
-- This repo's other migrations are INCREMENTAL DELTAS that Lovable's AI applied directly
-- to an already-existing hosted project; the base schema itself (this file) was never
-- exported here. Reconstructed from src/integrations/supabase/types.ts (exact column
-- shapes) cross-referenced against every ALTER/DROP POLICY/REVOKE statement in the later
-- delta migrations (which reveal exact pre-delta column/policy state where it matters).
-- Deliberately excludes columns/tables that a later delta adds via `ADD COLUMN IF NOT
-- EXISTS` / `CREATE TABLE IF NOT EXISTS` so those migrations apply unmodified on top.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- ============ enums ============
create type public.app_role as enum ('creator', 'brand', 'admin');
create type public.campaign_status as enum ('draft', 'published', 'closed');
create type public.compensation_type as enum ('paid', 'barter', 'hybrid');
create type public.deal_state as enum ('DISCOVERED','NEGOTIATING','ACCEPTED','CREATING','REVIEW','COMPLETED','CANCELLED');
create type public.fit_label as enum ('strong', 'good', 'potential', 'weak');
create type public.verification_status as enum ('unverified', 'pending', 'approved', 'rejected');

-- ============ helper functions (RLS depends on these from the start) ============
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ user_roles ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- LANGUAGE sql functions are validated against referenced tables at CREATE time, so
-- this must come after user_roles exists, before any policy (here or later) calls it.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
-- Self-service signup can only grant creator/brand — never admin (that requires service-role).
create policy "own roles insert" on public.user_roles for insert to authenticated
  with check (user_id = auth.uid() and role in ('creator', 'brand'));

-- ============ brand_profiles ============
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  brand_name text not null default '',
  website text,
  instagram text,
  industry text,
  about text,
  contact_person text,
  contact_email text,
  contact_phone text,
  campaign_categories text[] not null default '{}',
  logo_url text,
  is_seed boolean not null default false,
  onboarding_completed boolean not null default false,
  verification public.verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.brand_profiles to authenticated;
grant all on public.brand_profiles to service_role;
alter table public.brand_profiles enable row level security;
create policy "brand profiles readable" on public.brand_profiles for select to authenticated using (true);
create policy "own brand profile insert" on public.brand_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "own brand profile update" on public.brand_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger brand_profiles_updated_at before update on public.brand_profiles for each row execute function public.update_updated_at_column();

-- ============ creator_profiles ============
create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  display_name text not null default '',
  headline text,
  bio text,
  location text,
  avatar_url text,
  languages text[] not null default '{}',
  creator_types text[] not null default '{}',
  categories text[] not null default '{}',
  preferred_categories text[] not null default '{}',
  portfolio_links jsonb not null default '[]',
  starting_price_inr numeric,
  open_to_paid boolean not null default true,
  open_to_barter boolean not null default false,
  is_public boolean not null default true,
  is_seed boolean not null default false,
  onboarding_completed boolean not null default false,
  verification public.verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.creator_profiles to authenticated;
grant all on public.creator_profiles to service_role;
alter table public.creator_profiles enable row level security;
create policy "creator profiles readable" on public.creator_profiles for select to authenticated using (true);
create policy "own creator profile insert" on public.creator_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "own creator profile update" on public.creator_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger creator_profiles_updated_at before update on public.creator_profiles for each row execute function public.update_updated_at_column();

-- ============ brand_dna / creator_dna ============
create table public.brand_dna (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade unique,
  data jsonb not null default '{}',
  model text,
  confidence numeric,
  reviewed_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.brand_dna to authenticated;
grant all on public.brand_dna to service_role;
alter table public.brand_dna enable row level security;
create policy "brand dna readable" on public.brand_dna for select to authenticated
  using (exists (select 1 from public.brand_profiles b where b.id = brand_dna.brand_id and b.user_id = auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "own brand dna write" on public.brand_dna for insert to authenticated
  with check (exists (select 1 from public.brand_profiles b where b.id = brand_dna.brand_id and b.user_id = auth.uid()));
create policy "own brand dna update" on public.brand_dna for update to authenticated
  using (exists (select 1 from public.brand_profiles b where b.id = brand_dna.brand_id and b.user_id = auth.uid()));
create trigger brand_dna_updated_at before update on public.brand_dna for each row execute function public.update_updated_at_column();

create table public.creator_dna (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade unique,
  data jsonb not null default '{}',
  model text,
  confidence numeric,
  reviewed_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.creator_dna to authenticated;
grant all on public.creator_dna to service_role;
alter table public.creator_dna enable row level security;
create policy "creator dna readable" on public.creator_dna for select to authenticated
  using (exists (select 1 from public.creator_profiles c where c.id = creator_dna.creator_id and (c.is_public or c.user_id = auth.uid())) or public.has_role(auth.uid(), 'admin'));
create policy "own creator dna write" on public.creator_dna for insert to authenticated
  with check (exists (select 1 from public.creator_profiles c where c.id = creator_dna.creator_id and c.user_id = auth.uid()));
create policy "own creator dna update" on public.creator_dna for update to authenticated
  using (exists (select 1 from public.creator_profiles c where c.id = creator_dna.creator_id and c.user_id = auth.uid()));
create trigger creator_dna_updated_at before update on public.creator_dna for each row execute function public.update_updated_at_column();

-- ============ brand_updates ============
create table public.brand_updates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  title text not null,
  body text not null,
  categories text[] not null default '{}',
  creator_types text[] not null default '{}',
  compensation text,
  cta_url text,
  is_published boolean not null default true,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.brand_updates to authenticated;
grant all on public.brand_updates to service_role;
alter table public.brand_updates enable row level security;
create policy "brand updates readable" on public.brand_updates for select to authenticated
  using (is_published or exists (select 1 from public.brand_profiles b where b.id = brand_updates.brand_id and b.user_id = auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "own brand updates write" on public.brand_updates for all to authenticated
  using (exists (select 1 from public.brand_profiles b where b.id = brand_updates.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.brand_profiles b where b.id = brand_updates.brand_id and b.user_id = auth.uid()));
create trigger brand_updates_updated_at before update on public.brand_updates for each row execute function public.update_updated_at_column();

-- ============ campaigns / campaign_briefs ============
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  title text not null default '',
  status public.campaign_status not null default 'draft',
  compensation_type public.compensation_type not null default 'paid',
  budget_min numeric,
  budget_max numeric,
  raw_prompt text,
  is_seed boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
create policy "campaigns readable" on public.campaigns for select to authenticated
  using (status = 'published' or exists (select 1 from public.brand_profiles b where b.id = campaigns.brand_id and b.user_id = auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "own campaigns write" on public.campaigns for all to authenticated
  using (exists (select 1 from public.brand_profiles b where b.id = campaigns.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.brand_profiles b where b.id = campaigns.brand_id and b.user_id = auth.uid()));
create trigger campaigns_updated_at before update on public.campaigns for each row execute function public.update_updated_at_column();

create table public.campaign_briefs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade unique,
  data jsonb not null default '{}',
  model text,
  edited_by_brand boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.campaign_briefs to authenticated;
grant all on public.campaign_briefs to service_role;
alter table public.campaign_briefs enable row level security;
create policy "campaign briefs readable" on public.campaign_briefs for select to authenticated
  using (exists (select 1 from public.campaigns cm where cm.id = campaign_briefs.campaign_id and (cm.status = 'published' or exists (select 1 from public.brand_profiles b where b.id = cm.brand_id and b.user_id = auth.uid()))) or public.has_role(auth.uid(), 'admin'));
create policy "own campaign briefs write" on public.campaign_briefs for all to authenticated
  using (exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = campaign_briefs.campaign_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = campaign_briefs.campaign_id and b.user_id = auth.uid()));
create trigger campaign_briefs_updated_at before update on public.campaign_briefs for each row execute function public.update_updated_at_column();

-- ============ matches ============
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  score numeric not null default 0,
  fit public.fit_label not null default 'weak',
  signals jsonb not null default '{}',
  reasons jsonb not null default '[]',
  gaps jsonb not null default '[]',
  invited boolean not null default false,
  creator_interested boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
grant select, insert, update on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "parties read matches" on public.matches for select to authenticated
  using (
    exists (select 1 from public.creator_profiles c where c.id = matches.creator_id and c.user_id = auth.uid())
    or exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = matches.campaign_id and b.user_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );
create policy "brand inserts matches" on public.matches for insert to authenticated
  with check (exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = matches.campaign_id and b.user_id = auth.uid()));
create policy "parties update matches" on public.matches for update to authenticated
  using (
    exists (select 1 from public.creator_profiles c where c.id = matches.creator_id and c.user_id = auth.uid())
    or exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = matches.campaign_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.creator_profiles c where c.id = matches.creator_id and c.user_id = auth.uid())
    or exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = matches.campaign_id and b.user_id = auth.uid())
  );
create trigger matches_updated_at before update on public.matches for each row execute function public.update_updated_at_column();

-- ============ pitches ============
create table public.pitches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  message text not null,
  portfolio_url text,
  proposed_price_inr numeric,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.pitches to authenticated;
grant all on public.pitches to service_role;
alter table public.pitches enable row level security;
create policy "parties read pitches" on public.pitches for select to authenticated
  using (
    exists (select 1 from public.creator_profiles c where c.id = pitches.creator_id and c.user_id = auth.uid())
    or exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = pitches.campaign_id and b.user_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );
create policy "creator inserts pitch" on public.pitches for insert to authenticated
  with check (exists (select 1 from public.creator_profiles c where c.id = pitches.creator_id and c.user_id = auth.uid()));
create policy "parties update pitches" on public.pitches for update to authenticated
  using (
    exists (select 1 from public.creator_profiles c where c.id = pitches.creator_id and c.user_id = auth.uid())
    or exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = pitches.campaign_id and b.user_id = auth.uid())
  );
create trigger pitches_updated_at before update on public.pitches for each row execute function public.update_updated_at_column();

-- ============ shortlists ============
create table public.shortlists (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
grant select, insert, delete on public.shortlists to authenticated;
grant all on public.shortlists to service_role;
alter table public.shortlists enable row level security;
create policy "own shortlists" on public.shortlists for all to authenticated
  using (exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = shortlists.campaign_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.campaigns cm join public.brand_profiles b on b.id = cm.brand_id where cm.id = shortlists.campaign_id and b.user_id = auth.uid()));

-- ============ deals ============
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  state public.deal_state not null default 'DISCOVERED',
  compensation_type public.compensation_type not null default 'paid',
  agreed_amount_inr numeric,
  barter_details text,
  payment_secured boolean not null default false,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- UPDATE is granted here because an early delta adds a party UPDATE policy; a later
-- delta explicitly revokes it once all transitions move server-side — net effect after
-- all migrations run: no direct client UPDATE on deals, exactly as intended.
grant select, insert, update on public.deals to authenticated;
grant all on public.deals to service_role;
alter table public.deals enable row level security;
create policy "deal parties read" on public.deals for select to authenticated
  using (
    exists (select 1 from public.brand_profiles b where b.id = deals.brand_id and b.user_id = auth.uid())
    or exists (select 1 from public.creator_profiles c where c.id = deals.creator_id and c.user_id = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );
create trigger deals_updated_at before update on public.deals for each row execute function public.update_updated_at_column();

create or replace function public.is_deal_party(_deal_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.deals d
    join public.brand_profiles b on b.id = d.brand_id
    join public.creator_profiles c on c.id = d.creator_id
    where d.id = _deal_id and (b.user_id = _user_id or c.user_id = _user_id)
  );
$$;
revoke all on function public.is_deal_party(uuid, uuid) from public, anon;
grant execute on function public.is_deal_party(uuid, uuid) to authenticated, service_role;

-- ============ deal_events ============
create table public.deal_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  from_state public.deal_state,
  to_state public.deal_state not null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.deal_events to authenticated;
grant all on public.deal_events to service_role;
alter table public.deal_events enable row level security;
create policy "deal parties read events" on public.deal_events for select to authenticated
  using (public.is_deal_party(deal_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

-- ============ content_submissions ============
create table public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  kind text not null default 'link',
  url text not null,
  note text,
  status text not null default 'submitted',
  brand_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.content_submissions to authenticated;
grant all on public.content_submissions to service_role;
alter table public.content_submissions enable row level security;
create policy "deal parties read submissions" on public.content_submissions for select to authenticated
  using (public.is_deal_party(deal_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "creator inserts submission" on public.content_submissions for insert to authenticated
  with check (exists (select 1 from public.creator_profiles c where c.id = content_submissions.creator_id and c.user_id = auth.uid()));
create policy "deal parties update submissions" on public.content_submissions for update to authenticated
  using (public.is_deal_party(deal_id, auth.uid()));
create trigger content_submissions_updated_at before update on public.content_submissions for each row execute function public.update_updated_at_column();

-- ============ messages (legacy, parallel to conversation_messages) ============
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "deal parties read messages" on public.messages for select to authenticated
  using (public.is_deal_party(deal_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "deal parties insert messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_deal_party(deal_id, auth.uid()));

-- ============ feedback ============
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_role public.app_role not null,
  overall numeric,
  ratings jsonb not null default '{}',
  reasons text[] not null default '{}',
  decision text,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert on public.feedback to authenticated;
grant all on public.feedback to service_role;
alter table public.feedback enable row level security;
create policy "deal parties read feedback" on public.feedback for select to authenticated
  using (public.is_deal_party(deal_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "deal parties insert feedback" on public.feedback for insert to authenticated
  with check (author_id = auth.uid() and public.is_deal_party(deal_id, auth.uid()));

-- ============ disputes ============
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  raised_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.disputes to authenticated;
grant all on public.disputes to service_role;
alter table public.disputes enable row level security;
create policy "deal parties read disputes" on public.disputes for select to authenticated
  using ((deal_id is not null and public.is_deal_party(deal_id, auth.uid())) or raised_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "deal parties raise disputes" on public.disputes for insert to authenticated
  with check (raised_by = auth.uid() and (deal_id is null or public.is_deal_party(deal_id, auth.uid())));
create trigger disputes_updated_at before update on public.disputes for each row execute function public.update_updated_at_column();

-- ============ payments / payment_events (writes are service-role only) ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  provider text not null default 'mock',
  provider_session_id text,
  provider_payment_intent text,
  amount_inr numeric not null default 0,
  currency text not null default 'INR',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "deal parties read payments" on public.payments for select to authenticated
  using (public.is_deal_party(deal_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));
create trigger payments_updated_at before update on public.payments for each row execute function public.update_updated_at_column();

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete cascade,
  provider text not null default 'mock',
  provider_event_id text,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select on public.payment_events to authenticated;
grant all on public.payment_events to service_role;
alter table public.payment_events enable row level security;
create policy "deal parties read payment events" on public.payment_events for select to authenticated
  using (
    payment_id is not null
    and exists (select 1 from public.payments p where p.id = payment_events.payment_id and public.is_deal_party(p.deal_id, auth.uid()))
    or public.has_role(auth.uid(), 'admin')
  );

-- ============ social_accounts (token column never exposed to clients) ============
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'instagram',
  handle text,
  external_id text,
  followers integer,
  engagement_rate numeric,
  connected_via_oauth boolean not null default false,
  access_token_encrypted text,
  token_expires_at timestamptz,
  profile_data jsonb not null default '{}',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);
grant select (id, user_id, platform, handle, external_id, followers, engagement_rate,
              profile_data, connected_via_oauth, token_expires_at, last_synced_at,
              created_at, updated_at) on public.social_accounts to authenticated;
grant insert, delete on public.social_accounts to authenticated;
grant update (platform, handle, external_id, followers, engagement_rate, profile_data,
              connected_via_oauth, last_synced_at, updated_at, user_id, token_expires_at)
  on public.social_accounts to authenticated;
grant all on public.social_accounts to service_role;
alter table public.social_accounts enable row level security;
create policy "own social accounts read" on public.social_accounts for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "own social accounts insert" on public.social_accounts for insert to authenticated
  with check (user_id = auth.uid());
create policy "own social accounts update" on public.social_accounts for update to authenticated
  using (user_id = auth.uid());
create policy "own social accounts delete" on public.social_accounts for delete to authenticated
  using (user_id = auth.uid());
create trigger social_accounts_updated_at before update on public.social_accounts for each row execute function public.update_updated_at_column();

-- ============ notifications ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications mark read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ support_tickets ============
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  body text not null,
  contact_email text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "own support tickets" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "insert own support ticket" on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());
create trigger support_tickets_updated_at before update on public.support_tickets for each row execute function public.update_updated_at_column();

-- ============ verification_records ============
create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_type text not null,
  status public.verification_status not null default 'pending',
  evidence jsonb not null default '{}',
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.verification_records to authenticated;
grant all on public.verification_records to service_role;
alter table public.verification_records enable row level security;
create policy "own verification records" on public.verification_records for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "insert own verification record" on public.verification_records for insert to authenticated
  with check (user_id = auth.uid());
create trigger verification_records_updated_at before update on public.verification_records for each row execute function public.update_updated_at_column();

-- ============ ai_reviews (internal moderation queue — service-role managed) ============
create table public.ai_reviews (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid,
  status text not null default 'pending',
  model text,
  confidence numeric,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.ai_reviews to service_role;
alter table public.ai_reviews enable row level security;
create policy "admin reads ai reviews" on public.ai_reviews for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger ai_reviews_updated_at before update on public.ai_reviews for each row execute function public.update_updated_at_column();
