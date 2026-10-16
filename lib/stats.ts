import { computeElo, displayName, nyDate, nyHour, type loadEverything } from "./data";

type Data = Awaited<ReturnType<typeof loadEverything>>;

const ACTIVITY_DAYS = 30;
const SHORT_CAPTION = 60;

export type CaptionStat = {
  id: number;
  text: string;
  model: string | null;
  imagePath: string | null;
  headline: string | null;
  up: number;
  down: number;
  net: number;
  elo: number | null;
};

export function computeDashboard(data: Data) {
  const { profiles, images, captions, votes, battles, news } = data;
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const imageById = new Map(images.map((i) => [i.id, i]));
  const newsById = new Map(news.map((n) => [n.id, n]));
  const elo = computeElo(battles);

  // Per-caption vote tallies.
  const up = new Map<number, number>();
  const down = new Map<number, number>();
  for (const v of votes) {
    const tally = v.vote > 0 ? up : down;
    tally.set(v.caption_id, (tally.get(v.caption_id) ?? 0) + 1);
  }
  const captionStats: CaptionStat[] = captions.map((c) => {
    const u = up.get(c.id) ?? 0;
    const d = down.get(c.id) ?? 0;
    return {
      id: c.id,
      text: c.text,
      model: c.model,
      imagePath: c.image_id ? imageById.get(c.image_id)?.storage_path ?? null : null,
      headline: c.news_id ? newsById.get(c.news_id)?.headline ?? null : null,
      up: u,
      down: d,
      net: u - d,
      elo: elo.has(c.id) ? Math.round(elo.get(c.id)!) : null,
    };
  });
  const voted = captionStats.filter((c) => c.up + c.down > 0);

  const top = [...voted].sort((a, b) => b.net - a.net || b.up - a.up).slice(0, 5);
  const bottom = [...voted]
    .filter((c) => c.net < 0)
    .sort((a, b) => a.net - b.net || b.down - a.down)
    .slice(0, 5);
  // Divisive = lots of both. The smaller side is the size of the fight.
  const divisive = voted
    .filter((c) => c.up > 0 && c.down > 0)
    .sort((a, b) => Math.min(b.up, b.down) - Math.min(a.up, a.down) || b.up + b.down - (a.up + a.down))
    .slice(0, 5);
  const eloTop = captionStats
    .filter((c) => c.elo !== null)
    .sort((a, b) => b.elo! - a.elo!)
    .slice(0, 5);

  // Daily activity: votes + battle picks, last 30 New York days.
  const days: string[] = [];
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(nyDate(d));
  }
  const perDay = new Map(days.map((d) => [d, 0]));
  const perHour = Array.from({ length: 24 }, () => 0);
  for (const row of [...votes, ...battles]) {
    const day = nyDate(row.created_at);
    if (perDay.has(day)) perDay.set(day, perDay.get(day)! + 1);
    perHour[nyHour(row.created_at)]++;
  }
  const daily = days.map((day) => ({ label: day.slice(5), value: perDay.get(day)! }));
  const hourly = perHour.map((value, hour) => ({
    label: hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`,
    value,
  }));
  const busiestHour = hourly.reduce((best, h) => (h.value > best.value ? h : best), hourly[0]);

  // Which model writes the funniest captions?
  const wins = new Map<number, number>();
  const losses = new Map<number, number>();
  for (const b of battles) {
    wins.set(b.winner_id, (wins.get(b.winner_id) ?? 0) + 1);
    losses.set(b.loser_id, (losses.get(b.loser_id) ?? 0) + 1);
  }
  const byModel = new Map<string, { captions: number; net: number; wins: number; games: number }>();
  for (const c of captionStats) {
    const key = c.model ?? "unknown (before prompts were saved)";
    const m = byModel.get(key) ?? { captions: 0, net: 0, wins: 0, games: 0 };
    m.captions++;
    m.net += c.net;
    m.wins += wins.get(c.id) ?? 0;
    m.games += (wins.get(c.id) ?? 0) + (losses.get(c.id) ?? 0);
    byModel.set(key, m);
  }
  const models = [...byModel.entries()]
    .map(([model, m]) => ({
      model,
      captions: m.captions,
      avgNet: m.net / m.captions,
      winRate: m.games ? m.wins / m.games : null,
      games: m.games,
    }))
    .sort((a, b) => b.captions - a.captions);

  // Short vs long captions.
  const lengthBucket = (short: boolean) => {
    const group = voted.filter((c) => c.text.length < SHORT_CAPTION === short);
    return {
      count: group.length,
      avgNet: group.length ? group.reduce((s, c) => s + c.net, 0) / group.length : null,
    };
  };

  // Most active judges.
  const activity = new Map<string, { votes: number; battles: number; uploads: number }>();
  const bump = (id: string, key: "votes" | "battles" | "uploads") => {
    const a = activity.get(id) ?? { votes: 0, battles: 0, uploads: 0 };
    a[key]++;
    activity.set(id, a);
  };
  votes.forEach((v) => bump(v.user_id, "votes"));
  battles.forEach((b) => bump(b.user_id, "battles"));
  images.forEach((i) => bump(i.user_id, "uploads"));
  const topUsers = [...activity.entries()]
    .map(([id, a]) => ({ name: displayName(profileById.get(id)), ...a, total: a.votes + a.battles + a.uploads }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const upvotes = votes.filter((v) => v.vote > 0).length;

  return {
    totals: {
      users: profiles.length,
      images: images.length,
      captions: captions.length,
      votes: votes.length,
      battles: battles.length,
      headlines: news.length,
    },
    upvoteShare: votes.length ? upvotes / votes.length : null,
    unvotedShare: captions.length ? 1 - voted.length / captions.length : null,
    top,
    bottom,
    divisive,
    eloTop,
    daily,
    hourly,
    busiestHour,
    models,
    short: lengthBucket(true),
    long: lengthBucket(false),
    shortCutoff: SHORT_CAPTION,
    topUsers,
  };
}
