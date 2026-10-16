import { requireSuperadmin } from "@/lib/supabase/server";
import { loadEverything, signImageUrls } from "@/lib/data";
import { computeDashboard, type CaptionStat } from "@/lib/stats";
import BarChart from "./bar-chart";

export default async function DashboardPage() {
  const { supabase } = await requireSuperadmin();
  const data = await loadEverything(supabase);
  const s = computeDashboard(data);

  const shown = [...s.top, ...s.bottom, ...s.divisive, ...s.eloTop];
  const urls = await signImageUrls(supabase, [
    ...new Set(shown.map((c) => c.imagePath).filter((p): p is string => !!p)),
  ]);

  const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
  const signed = (x: number | null) =>
    x === null ? "–" : `${x > 0 ? "+" : ""}${x.toFixed(2)}`;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          What&apos;s happening across the caption app, live from the database.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Users" value={s.totals.users} />
        <Tile label="Photos" value={s.totals.images} />
        <Tile label="AI captions" value={s.totals.captions} />
        <Tile label="Votes" value={s.totals.votes} />
        <Tile label="Battle picks" value={s.totals.battles} />
        <Tile label="News headlines" value={s.totals.headlines} />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Insight
          emoji="👍"
          headline={pct(s.upvoteShare)}
          text="of all votes are upvotes. Students are a generous crowd."
        />
        <Insight
          emoji="👻"
          headline={pct(s.unvotedShare)}
          text="of AI captions have never received a single vote."
        />
        <Insight
          emoji="⏰"
          headline={s.busiestHour.value ? s.busiestHour.label : "–"}
          text="is the busiest hour for voting and battles (New York time)."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <BarChart
            title="Votes + battle picks per day (last 30 days)"
            unit="actions"
            data={s.daily}
            labelEvery={5}
          />
        </Card>
        <Card>
          <BarChart
            title="When do people play? Actions by hour of day"
            unit="actions"
            data={s.hourly}
            labelEvery={3}
          />
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <CaptionList title="🏆 Crowd favorites (net upvotes)" items={s.top} urls={urls} metric={(c) => `+${c.net}`} />
        <CaptionList title="🥀 Hall of shame (most downvoted)" items={s.bottom} urls={urls} metric={(c) => `${c.net}`} />
        <CaptionList
          title="⚔️ Most divisive (lots of 👍 and 👎)"
          items={s.divisive}
          urls={urls}
          metric={(c) => `👍${c.up} 👎${c.down}`}
        />
        <CaptionList title="👑 Battle champions (Elo)" items={s.eloTop} urls={urls} metric={(c) => `${c.elo}`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">🤖 Model showdown: which Gemini is funniest?</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="pb-2">Model</th>
                <th className="pb-2 text-right">Captions</th>
                <th className="pb-2 text-right">Avg net votes</th>
                <th className="pb-2 text-right">Battle win rate</th>
              </tr>
            </thead>
            <tbody>
              {s.models.map((m) => (
                <tr key={m.model} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 font-mono text-xs">{m.model}</td>
                  <td className="py-2 text-right">{m.captions}</td>
                  <td className="py-2 text-right">{signed(m.avgNet)}</td>
                  <td className="py-2 text-right">
                    {m.winRate === null ? "–" : `${pct(m.winRate)} (${m.games})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">✂️ Does brevity win?</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500">Short (&lt;{s.shortCutoff} chars)</p>
              <p className="text-2xl font-bold">{signed(s.short.avgNet)}</p>
              <p className="text-xs text-gray-500">avg net votes · {s.short.count} captions</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500">Long ({s.shortCutoff}+ chars)</p>
              <p className="text-2xl font-bold">{signed(s.long.avgNet)}</p>
              <p className="text-xs text-gray-500">avg net votes · {s.long.count} captions</p>
            </div>
          </div>

          <h2 className="mt-6 mb-3 text-sm font-semibold">🔥 Most active users</h2>
          <ol className="space-y-1 text-sm">
            {s.topUsers.map((u, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">
                  {i + 1}. {u.name}
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {u.votes} votes · {u.battles} battles · {u.uploads} uploads
                </span>
              </li>
            ))}
            {!s.topUsers.length && <li className="text-gray-500">No activity yet.</li>}
          </ol>
        </Card>
      </section>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {children}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function Insight({ emoji, headline, text }: { emoji: string; headline: string; text: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        <span className="mr-1">{emoji}</span>
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{headline}</span> {text}
      </p>
    </div>
  );
}

function CaptionList({
  title,
  items,
  urls,
  metric,
}: {
  title: string;
  items: CaptionStat[];
  urls: Map<string, string>;
  metric: (c: CaptionStat) => string;
}) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            {c.imagePath && urls.get(c.imagePath) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls.get(c.imagePath)} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-lg dark:bg-gray-800">
                📰
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm">{c.text}</p>
              {c.headline && <p className="truncate text-xs text-gray-500">on: {c.headline}</p>}
            </div>
            <span className="shrink-0 text-sm font-semibold">{metric(c)}</span>
          </li>
        ))}
        {!items.length && <li className="text-sm text-gray-500">Not enough data yet.</li>}
      </ul>
    </Card>
  );
}
