-- Flywheel v2: full Mirror signal set, dynamics, stance-labelled feedback.
-- Safe to re-run (IF NOT EXISTS).

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
