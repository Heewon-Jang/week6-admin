"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireSuperadmin } from "@/lib/supabase/server";
import { describeImage, writeCaptions } from "@/lib/gemini";

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

  let step1, step2;
  try {
    step1 = await describeImage(base64, mimeType, hint);
    step2 = await writeCaptions({ base64, mimeType }, step1.description, { count, hint });
  } catch (error) {
    return { error: `Couldn't caption that image: ${(error as Error).message}` };
  }

  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("images")
    .upload(path, Buffer.from(base64, "base64"), { contentType: mimeType });
  if (uploadError) return { error: uploadError.message };

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
  if (imageError) return { error: imageError.message };

  const { error: captionError } = await supabase.from("captions").insert(
    step2.captions.map((text) => ({
      image_id: image.id,
      text,
      prompt: step2.prompt,
      model: step2.model,
    }))
  );
  if (captionError) return { error: captionError.message };

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
