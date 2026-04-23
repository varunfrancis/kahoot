import Link from "next/link";
import { JoinGameForm } from "./join-game-form";

export default function Landing() {
  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Quiz</h1>
          <p className="text-sm text-neutral-500 mt-1">Join a game or host your own</p>
        </div>
        <JoinGameForm />
        <div className="text-center">
          <Link href="/login" className="text-sm text-neutral-500 hover:underline">
            Host sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}
