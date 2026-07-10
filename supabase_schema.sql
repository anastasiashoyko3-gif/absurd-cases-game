create table if not exists absurd_games (
  id bigint generated always as identity primary key,
  invite_code text unique,
  title text,
  mode text default 'court',
  phase text default 'lobby',
  round_no integer default 0,
  current_case_json text default '{}',
  theme text default 'classic',
  status text default 'active',
  created_at text
);

create table if not exists absurd_players (
  id bigint generated always as identity primary key,
  game_id bigint references absurd_games(id) on delete cascade,
  name text,
  pin text,
  avatar text,
  score integer default 0,
  role text,
  secret_instruction text,
  secret_mission text,
  vote_target text,
  created_at text
);

create table if not exists absurd_court_packs (
  id bigint generated always as identity primary key,
  title text,
  accusations_json text default '[]',
  objects_json text default '[]',
  created_at text
);

create table if not exists absurd_secret_missions (
  id bigint generated always as identity primary key,
  text text,
  active boolean default true,
  used_by text,
  used_at text,
  created_at text
);

alter table absurd_games add column if not exists theme text default 'classic';
alter table absurd_players add column if not exists secret_mission text;

alter table absurd_games disable row level security;
alter table absurd_players disable row level security;
alter table absurd_court_packs disable row level security;
alter table absurd_secret_missions disable row level security;

do $$
begin
  alter publication supabase_realtime add table absurd_games;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table absurd_players;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table absurd_court_packs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table absurd_secret_missions;
exception when duplicate_object then null;
end $$;
