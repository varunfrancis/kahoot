-- Multiplayer Quiz Game schema, RLS, RPCs, realtime.
-- Apply in the Supabase SQL editor once per project.

create extension if not exists pgcrypto;
create extension if not exists fuzzystrmatch;

-- ============================================================================
-- Tables
-- ============================================================================

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references auth.users not null,
  title text not null,
  created_at timestamptz not null default now()
);
create index quizzes_host_id_idx on quizzes(host_id);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes on delete cascade not null,
  question_order int not null,
  question_type text not null
    check (question_type in ('multiple_choice','true_false','ranking','word_cloud','type_answer')),
  text text not null,
  options jsonb,
  correct_answer jsonb,
  time_limit_seconds int not null default 20,
  unique (quiz_id, question_order)
);
create index questions_quiz_id_order_idx on questions(quiz_id, question_order);

create table game_rooms (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes not null,
  host_id uuid references auth.users not null,
  code text unique not null,
  status text not null default 'lobby'
    check (status in ('lobby','active','finished')),
  current_question_index int not null default -1,
  current_question_started_at timestamptz,
  created_at timestamptz not null default now()
);
create index game_rooms_code_idx on game_rooms(code);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references game_rooms on delete cascade not null,
  nickname text not null,
  score int not null default 0,
  joined_at timestamptz not null default now(),
  unique (room_id, nickname)
);
create index players_room_id_idx on players(room_id);

create table answers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players on delete cascade not null,
  question_id uuid references questions not null,
  response jsonb not null,
  time_taken_ms int not null,
  is_correct boolean not null,
  points_awarded int not null,
  created_at timestamptz not null default now(),
  unique (player_id, question_id)
);
create index answers_question_id_idx on answers(question_id);
create index answers_player_id_idx on answers(player_id);

-- ============================================================================
-- Row-level security
-- ============================================================================

alter table quizzes enable row level security;
alter table questions enable row level security;
alter table game_rooms enable row level security;
alter table players enable row level security;
alter table answers enable row level security;

-- quizzes: host CRUD their own
create policy quizzes_host_all on quizzes for all
  using (host_id = auth.uid()) with check (host_id = auth.uid());

-- questions: host CRUD via quiz ownership. No direct access for anon — they
-- use get_current_question() RPC which never leaks correct_answer.
create policy questions_host_all on questions for all
  using (exists (select 1 from quizzes q where q.id = questions.quiz_id and q.host_id = auth.uid()))
  with check (exists (select 1 from quizzes q where q.id = questions.quiz_id and q.host_id = auth.uid()));

-- game_rooms: host CRUD their own; anon + host can select (players look up by code).
create policy game_rooms_host_all on game_rooms for all
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy game_rooms_select_any on game_rooms for select using (true);

-- players: readable by anyone (nicknames + scores are not sensitive).
-- Writes happen only via security-definer RPCs (join_room, submit_answer).
create policy players_select_any on players for select using (true);

-- answers: readable by anyone. Inserts only via submit_answer RPC.
create policy answers_select_any on answers for select using (true);

-- ============================================================================
-- Realtime
-- ============================================================================

alter publication supabase_realtime add table game_rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table answers;

-- ============================================================================
-- Helpers
-- ============================================================================

-- Room code: 6 uppercase alphanumerics excluding 0, O, 1, I, L.
create or replace function generate_room_code() returns text
language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  end loop;
  return result;
end;
$$;

-- Normalize text for type_answer comparison: trim, lowercase, collapse whitespace.
create or replace function normalize_answer(s text) returns text
language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(s, '')), '\s+', ' ', 'g'));
$$;

-- ============================================================================
-- RPC: create_game_room
-- Called by authenticated host. Generates unique code, inserts room.
-- ============================================================================

create or replace function create_game_room(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from quizzes where id = p_quiz_id and host_id = auth.uid()) then
    raise exception 'quiz not found or not owned by caller';
  end if;

  loop
    v_code := generate_room_code();
    begin
      insert into game_rooms(quiz_id, host_id, code)
      values (p_quiz_id, auth.uid(), v_code)
      returning id into v_room_id;
      return jsonb_build_object('room_id', v_room_id, 'code', v_code);
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 10 then
        raise exception 'could not generate unique room code';
      end if;
    end;
  end loop;
end;
$$;

-- ============================================================================
-- RPC: join_room
-- Called by anon player. Validates room is in lobby, inserts player, returns id.
-- ============================================================================

create or replace function join_room(p_code text, p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room game_rooms%rowtype;
  v_player_id uuid;
  v_trimmed_nickname text;
begin
  v_trimmed_nickname := trim(coalesce(p_nickname, ''));
  if length(v_trimmed_nickname) = 0 then
    raise exception 'nickname required';
  end if;
  if length(v_trimmed_nickname) > 24 then
    raise exception 'nickname too long';
  end if;

  select * into v_room from game_rooms where code = upper(p_code);
  if not found then
    raise exception 'room not found';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'game already started';
  end if;

  begin
    insert into players(room_id, nickname) values (v_room.id, v_trimmed_nickname)
    returning id into v_player_id;
  exception when unique_violation then
    raise exception 'nickname already taken';
  end;

  return jsonb_build_object('player_id', v_player_id, 'room_id', v_room.id, 'code', v_room.code);
end;
$$;

-- ============================================================================
-- RPC: advance_question
-- Host-only. Moves from lobby→active (index 0), active→next question, or finished.
-- ============================================================================

create or replace function advance_question(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room game_rooms%rowtype;
  v_total_questions int;
  v_next_index int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_room from game_rooms where id = p_room_id and host_id = auth.uid();
  if not found then
    raise exception 'room not found or not owned by caller';
  end if;
  if v_room.status = 'finished' then
    return jsonb_build_object('status', 'finished');
  end if;

  select count(*) into v_total_questions from questions where quiz_id = v_room.quiz_id;
  v_next_index := v_room.current_question_index + 1;

  if v_next_index >= v_total_questions then
    update game_rooms
       set status = 'finished',
           current_question_started_at = null
     where id = p_room_id;
    return jsonb_build_object('status', 'finished');
  end if;

  update game_rooms
     set status = 'active',
         current_question_index = v_next_index,
         current_question_started_at = now()
   where id = p_room_id;
  return jsonb_build_object('status', 'active', 'current_question_index', v_next_index);
end;
$$;

-- ============================================================================
-- RPC: get_current_question
-- Returns the current question sanitized (no correct_answer). Accessible to anon.
-- ============================================================================

create or replace function get_current_question(p_code text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_room game_rooms%rowtype;
  v_question questions%rowtype;
  v_total int;
begin
  select * into v_room from game_rooms where code = upper(p_code);
  if not found then
    return null;
  end if;
  select count(*) into v_total from questions where quiz_id = v_room.quiz_id;
  if v_room.status <> 'active' or v_room.current_question_index < 0 then
    return jsonb_build_object(
      'status', v_room.status,
      'total_questions', v_total,
      'current_question_index', v_room.current_question_index
    );
  end if;
  select * into v_question
    from questions
   where quiz_id = v_room.quiz_id
     and question_order = v_room.current_question_index;
  if not found then
    return jsonb_build_object('status', v_room.status, 'total_questions', v_total);
  end if;
  return jsonb_build_object(
    'status', v_room.status,
    'total_questions', v_total,
    'current_question_index', v_room.current_question_index,
    'id', v_question.id,
    'question_type', v_question.question_type,
    'text', v_question.text,
    'options', v_question.options,
    'time_limit_seconds', v_question.time_limit_seconds,
    'started_at', v_room.current_question_started_at
  );
end;
$$;

-- ============================================================================
-- RPC: submit_answer
-- Anon-callable. Computes is_correct, points, time_taken_ms server-side and
-- records the answer atomically with the player's score update.
-- ============================================================================

create or replace function submit_answer(
  p_player_id uuid,
  p_question_id uuid,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question questions%rowtype;
  v_room game_rooms%rowtype;
  v_time_limit_ms int;
  v_time_taken_ms int;
  v_is_correct boolean := false;
  v_points int := 0;
  v_speed_multiplier double precision;
  v_correctly_placed int;
  v_order jsonb;
  v_i int;
  v_accepted jsonb;
  v_fuzzy boolean;
  v_normalized_input text;
  v_normalized_candidate text;
  v_threshold int;
begin
  select * into v_question from questions where id = p_question_id;
  if not found then
    raise exception 'question not found';
  end if;

  select gr.* into v_room
    from game_rooms gr
    join players p on p.room_id = gr.id
   where p.id = p_player_id;
  if not found then
    raise exception 'player not found';
  end if;
  if v_room.quiz_id <> v_question.quiz_id then
    raise exception 'question does not belong to this game';
  end if;
  if v_room.status <> 'active' or v_room.current_question_started_at is null then
    raise exception 'no active question';
  end if;
  if v_room.current_question_index <> v_question.question_order then
    raise exception 'question is not currently active';
  end if;

  v_time_limit_ms := v_question.time_limit_seconds * 1000;
  v_time_taken_ms := greatest(0, least(
    v_time_limit_ms,
    (extract(epoch from (now() - v_room.current_question_started_at)) * 1000)::int
  ));
  v_speed_multiplier := greatest(0.5, 1.0 - (v_time_taken_ms::double precision / v_time_limit_ms) / 2);

  case v_question.question_type
    when 'multiple_choice' then
      v_is_correct := (v_question.correct_answer->>'index')::int
                   = nullif(p_response->>'index','')::int;
      v_points := case when v_is_correct then round(1000 * v_speed_multiplier)::int else 0 end;

    when 'true_false' then
      v_is_correct := (v_question.correct_answer->>'value')::boolean
                   = nullif(p_response->>'value','')::boolean;
      v_points := case when v_is_correct then round(1000 * v_speed_multiplier)::int else 0 end;

    when 'ranking' then
      -- response.order is an array of ORIGINAL option indices in the player's
      -- ranked order. options are stored in the CORRECT order, so the correct
      -- sequence is [0, 1, 2, ...].
      v_order := p_response->'order';
      v_correctly_placed := 0;
      if jsonb_typeof(v_order) = 'array' then
        for v_i in 0..(jsonb_array_length(v_order) - 1) loop
          if (v_order->>v_i)::int = v_i then
            v_correctly_placed := v_correctly_placed + 1;
          end if;
        end loop;
      end if;
      v_is_correct := v_correctly_placed = jsonb_array_length(v_question.options);
      v_points := round(250 * v_correctly_placed * v_speed_multiplier)::int;

    when 'word_cloud' then
      v_is_correct := length(trim(coalesce(p_response->>'text',''))) > 0;
      v_points := case when v_is_correct then 200 else 0 end;

    when 'type_answer' then
      v_normalized_input := normalize_answer(p_response->>'text');
      v_accepted := v_question.correct_answer->'accepted';
      v_fuzzy := coalesce((v_question.correct_answer->>'fuzzy')::boolean, false);
      if jsonb_typeof(v_accepted) = 'array' and length(v_normalized_input) > 0 then
        for v_i in 0..(jsonb_array_length(v_accepted) - 1) loop
          v_normalized_candidate := normalize_answer(v_accepted->>v_i);
          if v_normalized_input = v_normalized_candidate then
            v_is_correct := true;
            exit;
          end if;
          if v_fuzzy then
            v_threshold := case when length(v_normalized_candidate) > 6 then 2 else 1 end;
            if levenshtein(v_normalized_input, v_normalized_candidate) <= v_threshold then
              v_is_correct := true;
              exit;
            end if;
          end if;
        end loop;
      end if;
      v_points := case when v_is_correct then round(1000 * v_speed_multiplier)::int else 0 end;

    else
      raise exception 'unknown question type: %', v_question.question_type;
  end case;

  begin
    insert into answers(player_id, question_id, response, time_taken_ms, is_correct, points_awarded)
    values (p_player_id, p_question_id, p_response, v_time_taken_ms, v_is_correct, v_points);
  exception when unique_violation then
    raise exception 'answer already submitted';
  end;

  update players set score = score + v_points where id = p_player_id;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'points_awarded', v_points,
    'time_taken_ms', v_time_taken_ms
  );
end;
$$;

-- ============================================================================
-- RPC: get_room_reveal
-- After a question closes, returns the correct answer + per-player results
-- for display on the between-question screen.
-- ============================================================================

create or replace function get_room_reveal(p_code text, p_question_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_room game_rooms%rowtype;
  v_question questions%rowtype;
begin
  select * into v_room from game_rooms where code = upper(p_code);
  if not found then return null; end if;
  select * into v_question from questions where id = p_question_id and quiz_id = v_room.quiz_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'question_id', v_question.id,
    'question_type', v_question.question_type,
    'correct_answer', v_question.correct_answer,
    'options', v_question.options
  );
end;
$$;

-- ============================================================================
-- Grants
-- ============================================================================

grant execute on function create_game_room(uuid) to authenticated;
grant execute on function advance_question(uuid) to authenticated;
grant execute on function join_room(text, text) to anon, authenticated;
grant execute on function get_current_question(text) to anon, authenticated;
grant execute on function submit_answer(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function get_room_reveal(text, uuid) to anon, authenticated;
