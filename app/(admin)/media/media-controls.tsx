"use client";

import { useState, useTransition } from "react";
import { deleteCaption, deleteImage, updateCaption, updateDescription } from "../../actions";
import type { CaptionRow } from "@/lib/data";

export function CaptionEditor({ caption, score }: { caption: CaptionRow; score: number }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(caption.text);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateCaption(caption.id, text);
      setError(result.error ?? "");
      if (!result.error) setEditing(false);
    });

  const remove = () => {
    if (!confirm("Delete this caption? Its votes and battles go with it.")) return;
    startTransition(async () => {
      const result = await deleteCaption(caption.id);
      setError(result.error ?? "");
    });
  };

  return (
    <li className={`rounded-lg bg-gray-50 p-3 dark:bg-gray-800 ${pending ? "opacity-60" : ""}`}>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={300}
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <div className="flex gap-2">
            <SmallButton onClick={save} disabled={pending} primary>
              Save
            </SmallButton>
            <SmallButton
              onClick={() => {
                setText(caption.text);
                setEditing(false);
                setError("");
              }}
              disabled={pending}
            >
              Cancel
            </SmallButton>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <p className="flex-1 text-sm">{caption.text}</p>
          <span
            className={`shrink-0 text-xs font-semibold ${
              score > 0 ? "text-green-700 dark:text-green-400" : score < 0 ? "text-red-700 dark:text-red-400" : "text-gray-500"
            }`}
            title="Net votes"
          >
            {score > 0 ? `+${score}` : score}
          </span>
          <SmallButton onClick={() => setEditing(true)} disabled={pending}>
            Edit
          </SmallButton>
          <SmallButton onClick={remove} disabled={pending} danger>
            Delete
          </SmallButton>
        </div>
      )}
      <p className="mt-1 font-mono text-[10px] text-gray-400">
        #{caption.id}
        {caption.model ? ` · ${caption.model}` : ""}
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}

export function DescriptionEditor({ imageId, initial }: { imageId: number; initial: string }) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const changed = text !== initial;

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-500">AI description</label>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus("");
        }}
        rows={3}
        className="w-full rounded border border-gray-200 bg-white p-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      />
      {(changed || status) && (
        <div className="flex items-center gap-2">
          {changed && (
            <SmallButton
              primary
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await updateDescription(imageId, text);
                  setStatus(result.error ?? result.message ?? "");
                })
              }
            >
              Save description
            </SmallButton>
          )}
          <span className="text-xs text-gray-500">{status}</span>
        </div>
      )}
    </div>
  );
}

export function DeleteImageButton({ imageId }: { imageId: number }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <SmallButton
        danger
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this photo and all of its captions, votes and battles?")) return;
          startTransition(async () => {
            const result = await deleteImage(imageId);
            setError(result.error ?? "");
          });
        }}
      >
        {pending ? "Deleting…" : "Delete photo"}
      </SmallButton>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const style = primary
    ? "bg-blue-600 text-white hover:bg-blue-700"
    : danger
      ? "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      : "border border-gray-300 hover:bg-white dark:border-gray-600 dark:hover:bg-gray-700";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 cursor-pointer rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}
