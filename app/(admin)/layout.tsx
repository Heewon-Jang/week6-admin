import { requireSuperadmin } from "@/lib/supabase/server";
import { signOut } from "../actions";
import NavLinks from "./nav-links";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireSuperadmin();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-gray-200 bg-white p-4 md:w-56 md:border-r md:border-b-0 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <p className="text-lg font-bold">🛠️ Caption Admin</p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{profile.email}</p>
        </div>
        <NavLinks />
        <form action={signOut} className="md:mt-auto">
          <button className="w-full cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
            Sign out
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
