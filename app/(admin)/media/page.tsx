import Link from "next/link";
import { requireSuperadmin } from "@/lib/supabase/server";
import { displayName, formatDateTime, loadEverything, signImageUrls } from "@/lib/data";
import { CaptionEditor, DeleteImageButton, DescriptionEditor } from "./media-controls";

// CREATE (link) / READ / UPDATE / DELETE AI-generated media.
export default async function MediaPage() {
  const { supabase } = await requireSuperadmin();
  const { profiles, images, captions, votes, news } = await loadEverything(supabase);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const score = new Map<number, number>();
  votes.forEach((v) => score.set(v.caption_id, (score.get(v.caption_id) ?? 0) + v.vote));
  const urls = await signImageUrls(supabase, images.map((i) => i.storage_path));

  const sortedImages = [...images].sort((a, b) => b.id - a.id);
  const sortedNews = [...news].sort((a, b) => b.news_date.localeCompare(a.news_date));
  const captionsFor = (key: "image_id" | "news_id", id: number) =>
    captions.filter((c) => c[key] === id).sort((a, b) => a.id - b.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Media</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {images.length} photos and {news.length} headlines with {captions.length} Gemini captions.
            Edit or delete anything; deleting cascades to votes and battles.
          </p>
        </div>
        <Link
          href="/media/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          ✨ Generate new media
        </Link>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Photos</h2>
        {sortedImages.map((img) => (
          <article
            key={img.id}
            id={`image-${img.id}`}
            className="grid scroll-mt-6 gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[200px_1fr] dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="space-y-2">
              {urls.get(img.storage_path) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls.get(img.storage_path)}
                  alt={img.description ?? ""}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-500 dark:bg-gray-800">
                  File missing
                </div>
              )}
              <p className="text-xs text-gray-500">
                #{img.id} · {displayName(profileById.get(img.user_id))}
                <br />
                {formatDateTime(img.created_at)}
                {img.description_model && (
                  <>
                    <br />
                    <span className="font-mono">{img.description_model}</span>
                  </>
                )}
              </p>
              <DeleteImageButton imageId={img.id} />
            </div>
            <div className="min-w-0 space-y-3">
              <DescriptionEditor imageId={img.id} initial={img.description ?? ""} />
              <ul className="space-y-2">
                {captionsFor("image_id", img.id).map((c) => (
                  <CaptionEditor key={c.id} caption={c} score={score.get(c.id) ?? 0} />
                ))}
              </ul>
            </div>
          </article>
        ))}
        {!images.length && <p className="text-sm text-gray-500">No photos yet.</p>}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">News headline captions</h2>
        {sortedNews.map((n) => (
          <article
            key={n.id}
            className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-sm">
              📰 <span className="font-semibold">{n.headline}</span>{" "}
              <span className="text-xs text-gray-500">({n.news_date})</span>
            </p>
            <ul className="space-y-2">
              {captionsFor("news_id", n.id).map((c) => (
                <CaptionEditor key={c.id} caption={c} score={score.get(c.id) ?? 0} />
              ))}
            </ul>
          </article>
        ))}
        {!news.length && <p className="text-sm text-gray-500">No headlines yet.</p>}
      </section>
    </div>
  );
}
