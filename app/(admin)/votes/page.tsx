import { requireSuperadmin } from "@/lib/supabase/server";
import { computeElo, displayName, formatDateTime, loadEverything } from "@/lib/data";

const SHOW_ROWS = 100;

// READ upvotes / downvotes / ratings.
export default async function VotesPage() {
  const { supabase } = await requireSuperadmin();
  const { profiles, captions, votes, battles } = await loadEverything(supabase);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const captionById = new Map(captions.map((c) => [c.id, c]));
  const elo = computeElo(battles);
  const caption = (id: number) => captionById.get(id)?.text ?? `(deleted caption #${id})`;

  const upvotes = votes.filter((v) => v.vote > 0).length;
  const recentVotes = [...votes].sort((a, b) => b.id - a.id).slice(0, SHOW_ROWS);
  const recentBattles = [...battles].sort((a, b) => b.id - a.id).slice(0, SHOW_ROWS);
  const ratings = [...elo.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Votes &amp; Ratings</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {votes.length} votes ({upvotes} 👍 · {votes.length - upvotes} 👎) and {battles.length} battle
          picks. Read-only.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <Table title={`Latest votes (newest ${SHOW_ROWS})`} headers={["When", "User", "Vote", "Caption"]}>
          {recentVotes.map((v) => (
            <tr key={v.id} className="border-t border-gray-100 align-top dark:border-gray-800">
              <td className="px-3 py-2 whitespace-nowrap text-gray-500">{formatDateTime(v.created_at)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{displayName(profileById.get(v.user_id))}</td>
              <td className="px-3 py-2">{v.vote > 0 ? "👍" : "👎"}</td>
              <td className="px-3 py-2">{caption(v.caption_id)}</td>
            </tr>
          ))}
        </Table>

        <Table
          title="Elo ratings from caption battles"
          headers={["Rank", "Rating", "Caption"]}
        >
          {ratings.map(([id, rating], i) => (
            <tr key={id} className="border-t border-gray-100 align-top dark:border-gray-800">
              <td className="px-3 py-2 text-gray-500">{i + 1}</td>
              <td className="px-3 py-2 font-semibold">{Math.round(rating)}</td>
              <td className="px-3 py-2">{caption(id)}</td>
            </tr>
          ))}
        </Table>
      </div>

      <Table
        title={`Latest battle picks (newest ${SHOW_ROWS})`}
        headers={["When", "Judge", "Winner", "Loser"]}
      >
        {recentBattles.map((b) => (
          <tr key={b.id} className="border-t border-gray-100 align-top dark:border-gray-800">
            <td className="px-3 py-2 whitespace-nowrap text-gray-500">{formatDateTime(b.created_at)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{displayName(profileById.get(b.user_id))}</td>
            <td className="px-3 py-2">🏆 {caption(b.winner_id)}</td>
            <td className="px-3 py-2 text-gray-500">{caption(b.loser_id)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Table({
  title,
  headers,
  children,
}: {
  title: string;
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="max-h-[32rem] overflow-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-800">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
