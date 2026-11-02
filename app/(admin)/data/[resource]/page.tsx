import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/supabase/server";
import { getResource } from "@/lib/resources";
import ResourceTable from "./resource-table";

const SHOW_ROWS = 200;

// READ any table in lib/resources.ts, plus whatever create/update/delete it allows.
export default async function ResourcePage(props: PageProps<"/data/[resource]">) {
  const { resource: slug } = await props.params;
  const resource = getResource(slug);
  if (!resource) notFound();

  const { supabase } = await requireSuperadmin();
  const columns = ["id", ...resource.fields.map((f) => f.key).filter((k) => k !== "id")];
  const { data: rows, error } = await supabase
    .from(resource.table)
    .select(columns.join(", "))
    .order("id", { ascending: false })
    .limit(SHOW_ROWS);

  // Labels for foreign keys, e.g. provider_id -> "Google Gemini".
  const refs: Record<string, Record<string, string>> = {};
  await Promise.all(
    resource.fields
      .filter((f) => f.type === "ref" && f.ref)
      .map(async (f) => {
        const { data } = await supabase.from(f.ref!.table).select(`id, ${f.ref!.label}`);
        refs[f.key] = Object.fromEntries(
          ((data ?? []) as unknown as Record<string, string | number>[]).map((r) => [
            String(r.id),
            String(r[f.ref!.label] ?? r.id),
          ])
        );
      })
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{resource.title}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {resource.description}{" "}
          {!resource.can.create && !resource.can.update && !resource.can.delete && "Read-only."}
        </p>
      </header>
      {error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Couldn&apos;t load {resource.table}: {error.message}. Has supabase/week7.sql been run?
        </p>
      ) : (
        <ResourceTable
          slug={resource.slug}
          rows={(rows ?? []) as unknown as Record<string, unknown>[]}
          refs={refs}
          limit={SHOW_ROWS}
        />
      )}
    </div>
  );
}
