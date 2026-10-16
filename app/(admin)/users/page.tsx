import { requireSuperadmin } from "@/lib/supabase/server";
import { displayName, formatDateTime, loadEverything } from "@/lib/data";

// READ users/profiles.
export default async function UsersPage() {
  const { supabase } = await requireSuperadmin();
  const { profiles, images, votes, battles } = await loadEverything(supabase);

  const count = (rows: { user_id: string }[]) => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1));
    return m;
  };
  const uploads = count(images);
  const voteCounts = count(votes);
  const battleCounts = count(battles);

  const rows = [...profiles].sort(
    (a, b) => Number(b.is_superadmin) - Number(a.is_superadmin) || displayName(a).localeCompare(displayName(b))
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {profiles.length} profiles. Read-only: superadmin access is granted in the Supabase SQL
          Editor, never from the app.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Uploads</th>
              <th className="px-4 py-3 text-right">Votes</th>
              <th className="px-4 py-3 text-right">Battles</th>
              <th className="px-4 py-3">Profile updated</th>
              <th className="px-4 py-3">ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold dark:bg-gray-700">
                        {displayName(p).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="font-medium">{displayName(p)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{p.email ?? "–"}</td>
                <td className="px-4 py-3">
                  {p.is_superadmin ? (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      Superadmin
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Member</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{uploads.get(p.id) ?? 0}</td>
                <td className="px-4 py-3 text-right">{voteCounts.get(p.id) ?? 0}</td>
                <td className="px-4 py-3 text-right">{battleCounts.get(p.id) ?? 0}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {p.updated_at ? formatDateTime(p.updated_at) : "–"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.id.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
