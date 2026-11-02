"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireSuperadmin } from "@/lib/supabase/server";
import { describeImage, writeCaptions } from "@/lib/gemini";
import { getResource, parseRow } from "@/lib/resources";
import { startRequest } from "@/lib/observability";

export type FormState = { error?: string; message?: string };

const MAX_IMAGE_LENGTH = 950_000;
const MAX_HINT_LENGTH = 200;
const MAX_CAPTION_LENGTH = 300;

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// CREATE: upload a photo, let Gemini describe it and write captions.
export async function createMedia(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireSuperadmin();

  const dataUrl = String(formData.get("image") ?? "");
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match || dataUrl.length > MAX_IMAGE_LENGTH) {
    return { error: "Choose an image to upload." };
  }
  const [, mimeType, base64] = match;
  const hint = String(formData.get("hint") ?? "").trim().slice(0, MAX_HINT_LENGTH) || undefined;
  const count = Math.min(10, Math.max(1, Number(formData.get("count")) || 5));

  const run = await startRequest(supabase, "photo");
  const fail = async (message: string) => {
    await run.fail(message);
    return { error: message };
  };

  let step1, step2;
  try {
    step1 = await run.step(
      1,
      () => describeImage(base64, mimeType, hint),
      (r) => ({ prompt: r.prompt, model: r.model, response: r.description })
    );
    const description = step1.description;
    step2 = await run.step(
      2,
      () => writeCaptions({ base64, mimeType }, description, { count, hint }),
      (r) => ({ prompt: r.prompt, model: r.model, response: JSON.stringify(r.captions, null, 2) })
    );
  } catch (error) {
    return fail(`Couldn't caption that image: ${(error as Error).message}`);
  }

  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("images")
    .upload(path, Buffer.from(base64, "base64"), { contentType: mimeType });
  if (uploadError) return fail(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("images").getPublicUrl(path);

  const { data: image, error: imageError } = await supabase
    .from("images")
    .insert({
      user_id: user.id,
      storage_path: path,
      image_url: publicUrl,
      description: step1.description,
      description_prompt: step1.prompt,
      description_model: step1.model,
    })
    .select("id")
    .single();
  if (imageError) return fail(imageError.message);

  const { error: captionError } = await supabase.from("captions").insert(
    step2.captions.map((text) => ({
      image_id: image.id,
      text,
      prompt: step2.prompt,
      model: step2.model,
    }))
  );
  if (captionError) return fail(captionError.message);
  await run.finish(image.id);

  revalidatePath("/", "layout");
  redirect(`/media#image-${image.id}`);
}

// UPDATE a caption's text.
export async function updateCaption(captionId: number, text: string): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  const trimmed = text.trim();
  if (!trimmed) return { error: "A caption can't be empty." };
  if (trimmed.length > MAX_CAPTION_LENGTH) {
    return { error: `Keep it under ${MAX_CAPTION_LENGTH} characters.` };
  }

  const { data, error } = await supabase
    .from("captions")
    .update({ text: trimmed })
    .eq("id", captionId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Nothing was updated. Check the admin RLS policies." };

  revalidatePath("/", "layout");
  return { message: "Saved." };
}

// UPDATE an image's description.
export async function updateDescription(imageId: number, text: string): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  const { data, error } = await supabase
    .from("images")
    .update({ description: text.trim() || null })
    .eq("id", imageId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Nothing was updated. Check the admin RLS policies." };

  revalidatePath("/", "layout");
  return { message: "Saved." };
}

// DELETE one caption (its votes and battles cascade).
export async function deleteCaption(captionId: number): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  const { data, error } = await supabase.from("captions").delete().eq("id", captionId).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Nothing was deleted. Check the admin RLS policies." };

  revalidatePath("/", "layout");
  return {};
}

// Generic CREATE / UPDATE / DELETE for the tables listed in lib/resources.ts.

// Postgres error codes -> messages an admin can act on.
function friendlyError(error: { code?: string; message: string }) {
  switch (error.code) {
    case "23505":
      return "That already exists.";
    case "23503":
      return "Other rows still use this one. Delete or change those first.";
    case "23514":
      return "That value isn't allowed (check the format or range).";
    default:
      return error.message;
  }
}

function resourceOrThrow(slug: string, op: "create" | "update" | "delete") {
  const resource = getResource(slug);
  if (!resource?.can[op]) throw new Error("That isn't allowed here.");
  return resource;
}

export async function createRow(slug: string, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  try {
    const resource = resourceOrThrow(slug, "create");
    const { error } = await supabase.from(resource.table).insert(parseRow(resource, formData));
    if (error) return { error: friendlyError(error) };
  } catch (error) {
    return { error: (error as Error).message };
  }
  revalidatePath(`/data/${slug}`);
  return { message: "Added." };
}

export async function updateRow(slug: string, id: number, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  try {
    const resource = resourceOrThrow(slug, "update");
    const row = parseRow(resource, formData);
    if (resource.fields.some((f) => f.key === "updated_at")) row.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from(resource.table).update(row).eq("id", id).select("id");
    if (error) return { error: friendlyError(error) };
    if (!data?.length) return { error: "Nothing was updated. Check the admin RLS policies." };
  } catch (error) {
    return { error: (error as Error).message };
  }
  revalidatePath(`/data/${slug}`);
  return { message: "Saved." };
}

export async function deleteRow(slug: string, id: number): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  try {
    const resource = resourceOrThrow(slug, "delete");
    const { data, error } = await supabase.from(resource.table).delete().eq("id", id).select("id");
    if (error) return { error: friendlyError(error) };
    if (!data?.length) return { error: "Nothing was deleted. Check the admin RLS policies." };
  } catch (error) {
    return { error: (error as Error).message };
  }
  revalidatePath(`/data/${slug}`);
  return {};
}

// DELETE an image, its file, and (by cascade) its captions and votes.
export async function deleteImage(imageId: number): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  const { data, error } = await supabase
    .from("images")
    .delete()
    .eq("id", imageId)
    .select("storage_path");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Nothing was deleted. Check the admin RLS policies." };

  // The row is gone either way; a leftover file is harmless, so don't fail on it.
  await supabase.storage.from("images").remove([data[0].storage_path]);

  revalidatePath("/", "layout");
  return {};
}
