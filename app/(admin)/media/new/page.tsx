import Link from "next/link";
import { requireSuperadmin } from "@/lib/supabase/server";
import CreateMediaForm from "./create-form";

export default async function NewMediaPage() {
  await requireSuperadmin();
  return (
    <div className="max-w-xl space-y-6">
      <header>
        <Link href="/media" className="text-sm text-blue-600 hover:underline">
          ← Back to AI Media
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Generate new media</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Upload a photo. Gemini describes it, then writes captions grounded in what it sees, using
          the same two-step prompt chain as the main app.
        </p>
      </header>
      <CreateMediaForm />
    </div>
  );
}
