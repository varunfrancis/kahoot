-- Aayushi-as-reference scoring rule.
-- Apply on top of 0001_init.sql. Safe to run once.

-- ============================================================================
-- Idempotency ledger: which (room, question) pairs have been finalized.
-- ============================================================================

create table if not exists question_finalizations (
  room_id uuid references game_rooms on delete cascade not null,
  question_id uuid references questions on delete cascade not null,
  finalized_at timestamptz not null default now(),
  aayushi_answered boolean not null,
  primary key (room_id, question_id)
);

-- ============================================================================
-- Case-insensitive uniqueness for nicknames so only one 'aayushi' per room.
-- ============================================================================

create unique index if not exists players_room_nickname_ci_idx
  on players (room_id, lower(nickname));

-- ============================================================================
-- submit_answer: now only records the response. Scoring is deferred to
-- finalize_question, which runs once the question closes.
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
begin
  select * into v_question from questions where id = p_question_id;
  if not found then raise exception 'question not found'; end if;

  select gr.* into v_room
    from game_rooms gr
    join players p on p.room_id = gr.id
   where p.id = p_player_id;
  if not found then raise exception 'player not found'; end if;
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

  begin
    insert into answers(
      player_id, question_id, response, time_taken_ms, is_correct, points_awarded
    )
    values (p_player_id, p_question_id, p_response, v_time_taken_ms, false, 0);
  exception when unique_violation then
    raise exception 'answer already submitted';
  end;

  return jsonb_build_object(
    'is_correct', false,
    'points_awarded', 0,
    'time_taken_ms', v_time_taken_ms
  );
end;
$$;

-- ============================================================================
-- finalize_question: scores every answer for a question using Aayushi as the
-- reference. Idempotent via question_finalizations PK. Runs from the host
-- client at reveal time, or from anon client as a safety net.
-- ============================================================================

create or replace function finalize_question(
  p_room_id uuid,
  p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question questions%rowtype;
  v_room game_rooms%rowtype;
  v_aayushi_player_id uuid;
  v_aayushi_answer answers%rowtype;
  v_ans answers%rowtype;
  v_time_limit_ms int;
  v_speed_multiplier double precision;
  v_is_correct boolean;
  v_points int;
  v_aayushi_order jsonb;
  v_ord jsonb;
  v_aayushi_text text;
  v_ans_text text;
  v_fuzzy boolean;
  v_threshold int;
  v_i int;
  v_all_match boolean;
  v_count int;
begin
  select * into v_room from game_rooms where id = p_room_id;
  if not found then raise exception 'room not found'; end if;

  select * into v_question from questions where id = p_question_id;
  if not found then raise exception 'question not found'; end if;
  if v_question.quiz_id <> v_room.quiz_id then
    raise exception 'question does not belong to this room';
  end if;

  -- Find Aayushi's player row + answer (if any) up front; we need this
  -- BEFORE claiming the idempotency ledger so the flag is accurate.
  select id into v_aayushi_player_id
    from players
   where room_id = p_room_id and lower(nickname) = 'aayushi'
   limit 1;
  if v_aayushi_player_id is not null then
    select * into v_aayushi_answer
      from answers
     where player_id = v_aayushi_player_id and question_id = p_question_id;
  end if;

  -- Claim the finalization slot; if another call already did, return silently.
  begin
    insert into question_finalizations(room_id, question_id, aayushi_answered)
    values (
      p_room_id,
      p_question_id,
      v_aayushi_player_id is not null and v_aayushi_answer.id is not null
    );
  exception when unique_violation then
    return jsonb_build_object('already_finalized', true);
  end;

  v_time_limit_ms := v_question.time_limit_seconds * 1000;
  v_count := 0;

  for v_ans in
    select * from answers where question_id = p_question_id
  loop
    v_speed_multiplier := greatest(
      0.5,
      1.0 - (v_ans.time_taken_ms::double precision / v_time_limit_ms) / 2
    );

    if v_question.question_type = 'word_cloud' then
      -- Speed-weighted 1000 for any submission with non-empty text.
      v_is_correct := length(trim(coalesce(v_ans.response->>'text',''))) > 0;
      v_points := case when v_is_correct then round(1000 * v_speed_multiplier)::int else 0 end;
    elsif v_aayushi_player_id is null or v_aayushi_answer.id is null then
      -- Aayushi missing or didn't answer → nobody scores on this question.
      v_is_correct := false;
      v_points := 0;
    else
      case v_question.question_type
        when 'multiple_choice' then
          v_is_correct := (v_ans.response->>'index') is not distinct from
                          (v_aayushi_answer.response->>'index');
        when 'true_false' then
          v_is_correct := (v_ans.response->>'value') is not distinct from
                          (v_aayushi_answer.response->>'value');
        when 'ranking' then
          v_ord := v_ans.response->'order';
          v_aayushi_order := v_aayushi_answer.response->'order';
          v_all_match := jsonb_typeof(v_ord) = 'array'
                     and jsonb_typeof(v_aayushi_order) = 'array'
                     and jsonb_array_length(v_ord) = jsonb_array_length(v_aayushi_order);
          if v_all_match then
            for v_i in 0..(jsonb_array_length(v_ord) - 1) loop
              if (v_ord->>v_i) is distinct from (v_aayushi_order->>v_i) then
                v_all_match := false;
                exit;
              end if;
            end loop;
          end if;
          v_is_correct := v_all_match;
        when 'type_answer' then
          v_ans_text := normalize_answer(v_ans.response->>'text');
          v_aayushi_text := normalize_answer(v_aayushi_answer.response->>'text');
          v_fuzzy := coalesce(
            (v_question.correct_answer->>'fuzzy')::boolean, false
          );
          if length(v_ans_text) = 0 then
            v_is_correct := false;
          elsif v_ans_text = v_aayushi_text then
            v_is_correct := true;
          elsif v_fuzzy then
            v_threshold := case when length(v_aayushi_text) > 6 then 2 else 1 end;
            v_is_correct := levenshtein(v_ans_text, v_aayushi_text) <= v_threshold;
          else
            v_is_correct := false;
          end if;
        else
          v_is_correct := false;
      end case;
      v_points := case when v_is_correct then round(1000 * v_speed_multiplier)::int else 0 end;
    end if;

    update answers
       set is_correct = v_is_correct,
           points_awarded = v_points
     where id = v_ans.id;
    update players
       set score = score + v_points
     where id = v_ans.player_id;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'finalized', true,
    'question_id', p_question_id,
    'answers_scored', v_count,
    'aayushi_answered',
      v_aayushi_player_id is not null and v_aayushi_answer.id is not null
  );
end;
$$;

grant execute on function finalize_question(uuid, uuid) to anon, authenticated;
