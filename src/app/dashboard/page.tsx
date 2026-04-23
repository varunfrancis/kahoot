import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateQuizButton } from "./create-quiz-button";
import { SignOutButton } from "./sign-out-button";
import type { Quiz } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (quizzes ?? []) as Quiz[];

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Your quizzes</h1>
          <p className="text-sm text-neutral-500">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-2">
          <CreateQuizButton />
          <SignOutButton />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-neutral-600 dark:text-neutral-400">
            No quizzes yet. Create your first one to get started.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((q) => (
            <li key={q.id}>
              <Card className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium">{q.title}</h2>
                  <p className="text-xs text-neutral-500">
                    Created {new Date(q.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/quizzes/${q.id}/edit`}>
                    <Button variant="secondary" size="sm">Edit</Button>
                  </Link>
                  <Link href={`/quizzes/${q.id}/host`}>
                    <Button size="sm">Launch</Button>
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
