import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizEditor } from "./quiz-editor";
import type { Quiz, Question } from "@/lib/supabase/types";

export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", id)
    .single();
  if (!quiz) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", id)
    .order("question_order", { ascending: true });

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <QuizEditor
        quiz={quiz as Quiz}
        initialQuestions={(questions ?? []) as Question[]}
      />
    </div>
  );
}
