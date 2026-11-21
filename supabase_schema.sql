-- ══════════════════════════════════════════════════════════════
--  CivicTrust — Complete Supabase SQL Schema
--  Run this in your Supabase Dashboard → SQL Editor → New Query
--  Safe to re-run: tables, policies, triggers and views are idempotent.
-- ══════════════════════════════════════════════════════════════
--
--  Why Supabase alongside the smart contract?
--  The contract stores escrow logic, votes, and state transitions.
--  Supabase stores everything that is too expensive or impractical
--  on-chain: photos, AI report text, GPS floats, activity feeds,
--  cached tender metadata for fast frontend queries, etc.
-- ══════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────
-- 1. WALLETS & ROLES  (cached from on-chain)
-- ────────────────────────────────────────────

create table if not exists wallets (
  address       text primary key,                       -- 0x... lowercase
  role          text not null check (role in ('municipal', 'contractor', 'ward_rep', 'oracle')),
  display_name  text,                                   -- human-readable label
  ward          text,                                   -- ward assignment (for ward reps)
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ────────────────────────────────────────────
-- 2. TENDERS  (off-chain metadata cache)
-- ────────────────────────────────────────────

create table if not exists tenders (
  id                  bigint primary key,               -- matches on-chain tenderId
  chain_tx_hash       text,                             -- createTender transaction hash
  title               text not null,
  ward                text not null,
  municipal_address   text not null references wallets(address),
  contractor_address  text not null,
  total_escrow_wei    text not null,                    -- stored as string (uint256 too big for int8)
  total_escrow_eth    numeric(20, 6),                   -- human-readable AVAX amount
  released_amount_eth numeric(20, 6) default 0,
  scope_of_work       text,                             -- full markdown scope
  scope_ipfs_cid      text,                             -- IPFS CID of scope document
  baseline_photo_url  text,                             -- Pinata gateway URL for the "before" photo
  baseline_ipfs_cid   text,                             -- IPFS CID of baseline photo
  gps_latitude        double precision,
  gps_longitude       double precision,
  gps_radius_meters   integer default 500,              -- geofence radius for citizen matching
  deadline            timestamptz,
  total_milestones    smallint not null default 1,
  current_milestone   smallint not null default 0,      -- 0-indexed
  status              text not null default 'active'
                      check (status in ('active', 'completed', 'cancelled')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_tenders_status on tenders(status);
create index if not exists idx_tenders_ward on tenders(ward);
create index if not exists idx_tenders_contractor on tenders(contractor_address);
create index if not exists idx_tenders_municipal on tenders(municipal_address);

-- ────────────────────────────────────────────
-- 3. MILESTONES
-- ────────────────────────────────────────────

create table if not exists milestones (
  id               bigserial primary key,
  tender_id        bigint not null references tenders(id) on delete cascade,
  milestone_index  smallint not null,                   -- 0-based index
  description      text,
  amount_wei       text not null,
  amount_eth       numeric(20, 6),
  status           text not null default 'funded'
                   check (status in ('funded', 'awaiting_vote', 'disputed', 'released')),
  ai_score         smallint,                            -- 0-100
  ai_structural    smallint,
  ai_materials     smallint,
  ai_completion    smallint,
  approvals_count  smallint default 0,
  rejections_count smallint default 0,
  released_at      timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),

  unique (tender_id, milestone_index)
);

create index if not exists idx_milestones_tender on milestones(tender_id);
create index if not exists idx_milestones_status on milestones(status);

-- ────────────────────────────────────────────
-- 4. WARD REP ASSIGNMENTS  (per-tender)
-- ────────────────────────────────────────────

create table if not exists tender_ward_reps (
  id          bigserial primary key,
  tender_id   bigint not null references tenders(id) on delete cascade,
  rep_address text not null,
  rep_role    text,                                     -- 'Chairperson', 'Community Engineer', 'Civic Auditor'
  slot_index  smallint not null check (slot_index between 0 and 2),  -- 0, 1, or 2

  unique (tender_id, slot_index),
  unique (tender_id, rep_address)
);

create index if not exists idx_ward_reps_address on tender_ward_reps(rep_address);

-- ────────────────────────────────────────────
-- 5. CITIZEN EVIDENCE  (uploaded via backend)
-- ────────────────────────────────────────────

create table if not exists citizen_evidence (
  id                bigserial primary key,
  tender_id         bigint not null references tenders(id) on delete cascade,
  milestone_index   smallint not null,
  photo_ipfs_cid    text not null,                      -- Pinata IPFS CID of the "after" photo
  photo_url         text,                               -- Pinata gateway URL
  citizen_notes     text,
  citizen_gps_lat   double precision,
  citizen_gps_lng   double precision,
  gps_distance_m    double precision,                   -- calculated distance from tender GPS
  submitted_at      timestamptz default now(),
  chain_tx_hash     text                                -- submitEvidence tx hash once confirmed
);

create index if not exists idx_evidence_tender on citizen_evidence(tender_id);

-- ────────────────────────────────────────────
-- 6. AI AUDIT REPORTS  (Gemini Vision results)
-- ────────────────────────────────────────────

create table if not exists ai_reports (
  id                bigserial primary key,
  tender_id         bigint not null references tenders(id) on delete cascade,
  milestone_index   smallint not null,
  evidence_id       bigint references citizen_evidence(id),
  overall_score     smallint not null,                  -- 0-100
  structural_score  smallint,
  materials_score   smallint,
  completion_score  smallint,
  report_text       text,                               -- Full Gemini AI response text
  report_ipfs_cid   text,                               -- IPFS CID of the report JSON
  defects_found     text[],                             -- Array of defect descriptions
  passed            boolean generated always as (overall_score >= 75) stored,
  analyzed_at       timestamptz default now(),
  chain_tx_hash     text                                -- submitAIScore tx hash once confirmed
);

create index if not exists idx_ai_reports_tender on ai_reports(tender_id);

-- ────────────────────────────────────────────
-- 7. WARD VOTES  (cached from on-chain events)
-- ────────────────────────────────────────────

create table if not exists ward_votes (
  id               bigserial primary key,
  tender_id        bigint not null references tenders(id) on delete cascade,
  milestone_index  smallint not null,
  rep_address      text not null,
  rep_role         text,                                -- 'Chairperson', etc.
  approved         boolean not null,
  chain_tx_hash    text,
  voted_at         timestamptz default now(),

  unique (tender_id, milestone_index, rep_address)
);

create index if not exists idx_ward_votes_tender on ward_votes(tender_id);

-- ────────────────────────────────────────────
-- 8. ACTIVITY LOG  (on-chain event feed)
-- ────────────────────────────────────────────

create table if not exists activity_log (
  id            bigserial primary key,
  tender_id     bigint references tenders(id) on delete set null,
  event_type    text not null,
                -- 'tender_created', 'evidence_submitted', 'ai_score_submitted',
                -- 'vote_cast', 'milestone_released', 'milestone_disputed',
                -- 'contractor_reassigned', 'tender_cancelled', 'tender_completed',
                -- 'municipal_authorized', 'ward_rep_authorized'
  actor_address text,                                   -- wallet that triggered the event
  summary       text,                                   -- human-readable summary
  metadata      jsonb default '{}',                     -- extra event data (scores, amounts, etc.)
  chain_tx_hash text,
  block_number  bigint,
  created_at    timestamptz default now()
);

create index if not exists idx_activity_tender on activity_log(tender_id);
create index if not exists idx_activity_type on activity_log(event_type);
create index if not exists idx_activity_created on activity_log(created_at desc);

-- ────────────────────────────────────────────
-- 9. IPFS PINS  (Pinata pin tracking)
-- ────────────────────────────────────────────

create table if not exists ipfs_pins (
  id          bigserial primary key,
  cid         text not null unique,
  pin_type    text not null check (pin_type in ('scope', 'baseline_photo', 'after_photo', 'ai_report')),
  tender_id   bigint references tenders(id) on delete set null,
  file_name   text,
  file_size   bigint,                                   -- bytes
  mime_type   text,
  gateway_url text,                                     -- https://gateway.pinata.cloud/ipfs/<cid>
  pinned_at   timestamptz default now()
);

create index if not exists idx_pins_tender on ipfs_pins(tender_id);

-- ══════════════════════════════════════════════════════════════
-- 10. ROW LEVEL SECURITY — Permissive for Testing
-- ══════════════════════════════════════════════════════════════
-- Enable RLS on all tables but allow all operations during development.
-- Replace these with proper role-based policies before production.

alter table wallets           enable row level security;
alter table tenders           enable row level security;
alter table milestones        enable row level security;
alter table tender_ward_reps  enable row level security;
alter table citizen_evidence  enable row level security;
alter table ai_reports        enable row level security;
alter table ward_votes        enable row level security;
alter table activity_log      enable row level security;
alter table ipfs_pins         enable row level security;

-- Permissive policies (TESTING ONLY).
-- NOTE: Postgres has no "CREATE POLICY IF NOT EXISTS", so we DROP IF EXISTS first.
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'wallets', 'tenders', 'milestones', 'tender_ward_reps',
      'citizen_evidence', 'ai_reports', 'ward_votes', 'activity_log', 'ipfs_pins'
    ])
  loop
    -- SELECT
    execute format('drop policy if exists %I on %I', tbl || '_select_all', tbl);
    execute format('create policy %I on %I for select using (true)', tbl || '_select_all', tbl);
    -- INSERT
    execute format('drop policy if exists %I on %I', tbl || '_insert_all', tbl);
    execute format('create policy %I on %I for insert with check (true)', tbl || '_insert_all', tbl);
    -- UPDATE
    execute format('drop policy if exists %I on %I', tbl || '_update_all', tbl);
    execute format('create policy %I on %I for update using (true) with check (true)', tbl || '_update_all', tbl);
    -- DELETE
    execute format('drop policy if exists %I on %I', tbl || '_delete_all', tbl);
    execute format('create policy %I on %I for delete using (true)', tbl || '_delete_all', tbl);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════
-- 11. HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════

-- Auto-update the updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at (drop first so the script can be re-run)
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array['wallets', 'tenders', 'milestones'])
  loop
    execute format('drop trigger if exists set_updated_at on %I', tbl);
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function update_updated_at()',
      tbl
    );
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════
-- 12. VIEWS — Convenient joins for the frontend
-- ══════════════════════════════════════════════════════════════

-- Tender detail with current milestone info
create or replace view tender_details as
select
  t.*,
  m.status           as current_milestone_status,
  m.ai_score         as current_ai_score,
  m.approvals_count  as current_approvals,
  m.rejections_count as current_rejections,
  ar.report_text     as latest_ai_report,
  ar.defects_found   as latest_defects
from tenders t
left join milestones m
  on m.tender_id = t.id and m.milestone_index = t.current_milestone
left join lateral (
  select report_text, defects_found
  from ai_reports
  where ai_reports.tender_id = t.id and ai_reports.milestone_index = t.current_milestone
  order by analyzed_at desc
  limit 1
) ar on true;

-- Dashboard stats
create or replace view dashboard_stats as
select
  count(*) filter (where status = 'active')    as active_tenders,
  count(*) filter (where status = 'completed') as completed_tenders,
  count(*) filter (where status = 'cancelled') as cancelled_tenders,
  coalesce(sum(total_escrow_eth) filter (where status = 'active'), 0)    as total_locked_escrow,
  coalesce(sum(released_amount_eth), 0)                                   as total_disbursed
from tenders;