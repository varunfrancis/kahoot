import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LaunchButton } from "./launch-button";
import type { Quiz, Question } from "@/lib/supabase/types";

export default async function HostLaunchPage({
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
    .select("id, question_type, text")
    .eq("quiz_id", id)
    .order("question_order", { ascending: true });

  const rows = (questions ?? []) as Pick<Question, "id" | "question_type" | "text">[];

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
        ← Back to dashboard
      </Link>
      <Card className="mt-6 text-center">
        <h1 className="text-2xl font-semibold">{(quiz as Quiz).title}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {rows.length} question{rows.length === 1 ? "" : "s"}
        </p>
        {rows.length === 0 ? (
          <div className="mt-6">
            <p className="text-sm text-red-600 mb-4">Add at least one question before launching.</p>
            <Link href={`/quizzes/${id}/edit`}>
              <Button variant="secondary">Edit quiz</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <LaunchButton quizId={id} />
          </div>
        )}
      </Card>
    </div>
  );
}
