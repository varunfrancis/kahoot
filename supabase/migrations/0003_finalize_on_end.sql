-- Move score finalization from per-question reveal to end-of-game.
-- Apply after 0002.

-- finalize_game: iterate every question in the quiz and run finalize_question
-- on each. finalize_question is already idempotent via question_finalizations.
create or replace function finalize_game(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room game_rooms%rowtype;
  v_q record;
  v_count int := 0;
begin
  select * into v_room from game_rooms where id = p_room_id;
  if not found then raise exception 'room not found'; end if;

  for v_q in
    select id from questions where quiz_id = v_room.quiz_id order by question_order
  loop
    perform finalize_question(p_room_id, v_q.id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('finalized_questions', v_count);
end;
$$;

grant execute on function finalize_game(uuid) to anon, authenticated;

-- Extend advance_question: when the host advances past the last question, flip
-- the room to 'finished' AND finalize every question's scoring in the same
-- transaction so players see their final scores immediately.
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
  v_q record;
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

    -- Score everything at game end, against Aayushi's submissions.
    for v_q in
      select id from questions where quiz_id = v_room.quiz_id order by question_order
    loop
      perform finalize_question(p_room_id, v_q.id);
    end loop;

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
