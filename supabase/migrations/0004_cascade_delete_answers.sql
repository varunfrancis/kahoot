-- Allow hosts to delete questions even after a game has been played.
-- Without cascade, answers.question_id FK blocks deletion.
-- question_finalizations.question_id already cascades (see 0002).

alter table answers
  drop constraint answers_question_id_fkey;

alter table answers
  add constraint answers_question_id_fkey
  foreign key (question_id) references questions(id) on delete cascade;
