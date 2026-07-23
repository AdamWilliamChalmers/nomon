-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text unique,
  display_name text,
  birth_year integer,
  account_status text default 'active',
  parent_guardian_email text,
  parent_consent_at timestamptz,
  is_family_plan boolean default false,
  share_card_public boolean default false,
  onboarding_goals jsonb,
  exemptions jsonb default '[]',
  pro boolean default false,
  pro_activated_at timestamptz,
  polar_order_id text unique,
  api_token text unique
);

-- Child-initiated family sharing (weekly card only — no session logs)
create table family_shares (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid references users(id) on delete cascade not null,
  parent_email text not null,
  invite_token uuid default gen_random_uuid(),
  status text default 'pending',
  created_at timestamptz default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  unique(child_user_id, parent_email)
);

create index family_shares_parent on family_shares(parent_email, status);
create index family_shares_child on family_shares(child_user_id, status);

-- Sessions — one row per extension session POST
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  session_date date not null,
  platform text not null,
  duration_minutes integer,
  message_count integer,
  composite_score integer,
  human_state text,
  depth_moments integer default 0,
  questions_asked integer default 0,
  conscious_delegates integer default 0,
  loop_breaks_taken integer default 0,
  interventions_fired integer default 0,
  interventions_bypassed integer default 0,
  reflections_submitted integer default 0,
  lumi_mode boolean default false,
  lumi_rituals_completed integer default 0,
  lumi_homework_suggested integer default 0,
  signals jsonb,
  feedback jsonb default '[]',
  created_at timestamptz default now()
);

-- Weekly summaries — generated every Monday from sessions
create table weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  week_start date not null,
  shape text,
  intentional_pct integer,
  questions_asked integer,
  depth_moments integer,
  conscious_delegates integer,
  loop_breaks_taken integer,
  session_count integer,
  total_messages integer,
  insight_line text,
  card_shared boolean default false,
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

create index sessions_user_date on sessions(user_id, session_date);
create index weekly_user_week on weekly_summaries(user_id, week_start);

-- Individual signal feedback events (flywheel training data)
create table signal_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_date date,
  platform text,
  signal_type text,
  task_type text,
  verdict text not null,
  score integer,
  prompt_snippet text,
  created_at timestamptz default now()
);

create index signal_feedback_task on signal_feedback(task_type, verdict);
create index signal_feedback_signal on signal_feedback(signal_type, verdict);

-- Flywheel v2 — full Mirror signal set, dynamics, stance labels
alter table sessions add column if not exists schema_version integer default 1;
alter table sessions add column if not exists mode text;
alter table sessions add column if not exists badge_enabled boolean default false;
alter table sessions add column if not exists handoff_count integer default 0;
alter table sessions add column if not exists loop_count integer default 0;
alter table sessions add column if not exists drift_count integer default 0;
alter table sessions add column if not exists mismatch_count integer default 0;
alter table sessions add column if not exists engaged_count integer default 0;
alter table sessions add column if not exists scaffold_count integer default 0;
alter table sessions add column if not exists attempt_first_count integer default 0;
alter table sessions add column if not exists avg_dwell_ratio real;
alter table sessions add column if not exists low_dwell_count integer default 0;
alter table sessions add column if not exists paste_count integer default 0;
alter table sessions add column if not exists dynamics jsonb default '{}';
alter table sessions add column if not exists task_type_counts jsonb default '{}';
alter table sessions add column if not exists platform_stats jsonb default '{}';
alter table sessions add column if not exists response_counts jsonb default '{}';

alter table signal_feedback add column if not exists stance text;
alter table signal_feedback add column if not exists dwell_ratio real;
alter table signal_feedback add column if not exists pasted boolean;
alter table signal_feedback add column if not exists confidence text;

-- Calibration study self-report (Route 3)
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_date date,
  platform text,
  composite_score integer,
  q1 integer not null check (q1 between 1 and 7),
  q2 integer not null check (q2 between 1 and 7),
  q3 integer not null check (q3 between 1 and 7),
  q4 integer not null check (q4 between 1 and 7),
  q5 integer not null check (q5 between 1 and 7),
  created_at timestamptz default now()
);

create index survey_responses_user on survey_responses(user_id, session_date);

-- Pro tier (migration-safe)
alter table users add column if not exists pro boolean default false;
alter table users add column if not exists pro_activated_at timestamptz;
alter table users add column if not exists polar_order_id text unique;
alter table users add column if not exists api_token text unique;

-- Lumi (kids mode) session fields (migration-safe)
alter table sessions add column if not exists lumi_mode boolean default false;
alter table sessions add column if not exists lumi_rituals_completed integer default 0;
alter table sessions add column if not exists lumi_homework_suggested integer default 0;
