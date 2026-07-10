create table if not exists absurd_games (
  id bigint generated always as identity primary key,
  invite_code text unique,
  title text,
  mode text default 'court',
  phase text default 'lobby',
  round_no integer default 0,
  current_case_json text default '{}',
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
  vote_target text,
  created_at text
);

alter table absurd_games disable row level security;
alter table absurd_players disable row level security;

alter publication supabase_realtime add table absurd_games;
alter publication supabase_realtime add table absurd_players;
