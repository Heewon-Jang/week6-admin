"use client";

import { useActionState, useState } from "react";
import { createMedia } from "../../../actions";
import { resizeImage } from "@/lib/resize-image";

const MAX_IMAGE_SIZE = 1024;

export default function CreateMediaForm() {
  const [state, action, pending] = useActionState(createMedia, {});
  const [image, setImage] = useState("");
  const [photoError, setPhotoError] = useState("");

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("That file isn't an image.");
      return;
    }
    try {
      setPhotoError("");
      setImage(await resizeImage(file, MAX_IMAGE_SIZE, { quality: 0.8 }));
    } catch (error) {
      setPhotoError((error as Error).message);
    }
  };

  return (
    <form
      action={action}
      className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-gray-300 p-4 text-center hover:border-blue-400 dark:border-gray-700">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="Selected photo" className="max-h-64 rounded" />
        ) : (
          <>
            <span className="text-3xl">📷</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Click to choose a photo</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={pending}
          onChange={(e) => pickPhoto(e.target.files?.[0])}
        />
      </label>
      <input type="hidden" name="image" value={image} />
      {photoError && <p className="text-sm text-red-600">{photoError}</p>}

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <label className="space-y-1">
          <span className="text-sm font-medium">Context for the AI (optional)</span>
          <input
            name="hint"
            maxLength={200}
            placeholder="e.g. Butler Library during finals"
            disabled={pending}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Captions</span>
          <select
            name="count"
            defaultValue="5"
            disabled={pending}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
          >
            {[3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        disabled={!image || pending}
        className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Gemini is looking and writing… (about 10–20s)" : "✨ Generate captions"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
