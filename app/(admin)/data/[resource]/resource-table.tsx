"use client";

import { useState, useTransition } from "react";
import { createRow, deleteRow, updateRow } from "../../../actions";
import { getResource, type Field } from "@/lib/resources";
import { formatDateTime } from "@/lib/data";

type Row = Record<string, unknown>;
type Refs = Record<string, Record<string, string>>;

const LONG_TEXT = 160;

export default function ResourceTable({
  slug,
  rows,
  refs,
  limit,
}: {
  slug: string;
  rows: Row[];
  refs: Refs;
  limit: number;
}) {
  const resource = getResource(slug)!;
  const { can } = resource;
  const editable = resource.fields.filter((f) => f.editable);

  return (
    <div className="space-y-6">
      {can.create && <CreateForm slug={slug} fields={editable} refs={refs} />}

      <p className="text-xs text-gray-500">
        {rows.length === limit ? `Newest ${limit} rows.` : `${rows.length} rows.`}
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-800">
            <tr>
              {resource.fields.map((f) => (
                <th key={f.key} className="px-3 py-3">
                  {f.label}
                </th>
              ))}
              {(can.update || can.delete) && <th className="px-3 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ResourceRow key={String(row.id)} slug={slug} row={row} refs={refs} />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={resource.fields.length + 1} className="px-3 py-6 text-center text-gray-500">
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResourceRow({ slug, row, refs }: { slug: string; row: Row; refs: Refs }) {
  const resource = getResource(slug)!;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const id = Number(row.id);
  const formId = `edit-${slug}-${id}`;

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateRow(slug, id, formData);
      setError(result.error ?? "");
      if (!result.error) setEditing(false);
    });

  const remove = () => {
    if (!confirm(`Delete this row from ${resource.title}?`)) return;
    startTransition(async () => {
      const result = await deleteRow(slug, id);
      setError(result.error ?? "");
    });
  };

  return (
    <tr className={`border-t border-gray-100 align-top dark:border-gray-800 ${pending ? "opacity-60" : ""}`}>
      {resource.fields.map((f) => (
        <td key={f.key} className="px-3 py-2">
          {editing && f.editable ? (
            <Input field={f} refs={refs} value={row[f.key]} form={formId} disabled={pending} />
          ) : (
            <Cell field={f} value={row[f.key]} refs={refs} />
          )}
        </td>
      ))}
      {(resource.can.update || resource.can.delete) && (
        <td className="px-3 py-2">
          <form id={formId} action={save} className="flex flex-wrap justify-end gap-2">
            {editing ? (
              <>
                {/* Keys stop React reusing the Edit button as Save mid-click, which would submit. */}
                <SmallButton key="save" type="submit" primary disabled={pending}>
                  Save
                </SmallButton>
                <SmallButton
                  key="cancel"
                  onClick={() => {
                    setEditing(false);
                    setError("");
                  }}
                  disabled={pending}
                >
                  Cancel
                </SmallButton>
              </>
            ) : (
              <>
                {resource.can.update && (
                  <SmallButton key="edit" onClick={() => setEditing(true)} disabled={pending}>
                    Edit
                  </SmallButton>
                )}
                {resource.can.delete && (
                  <SmallButton key="delete" onClick={remove} disabled={pending} danger>
                    Delete
                  </SmallButton>
                )}
              </>
            )}
          </form>
          {error && <p className="mt-1 max-w-48 text-right text-xs text-red-600">{error}</p>}
        </td>
      )}
    </tr>
  );
}

function CreateForm({ slug, fields, refs }: { slug: string; fields: Field[]; refs: Refs }) {
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  // Bumped after a successful add so the form remounts empty.
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const add = (formData: FormData) =>
    startTransition(async () => {
      const result = await createRow(slug, formData);
      setStatus(result);
      if (!result.error) setFormKey((k) => k + 1);
    });

  return (
    <form
      key={formKey}
      action={add}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <p className="text-sm font-semibold">Add new</p>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className={`space-y-1 ${f.type === "textarea" ? "md:col-span-2" : ""}`}>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {f.label}
              {f.required && " *"}
            </span>
            <Input field={f} refs={refs} value={f.type === "boolean" ? true : undefined} disabled={pending} />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <SmallButton type="submit" primary disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </SmallButton>
        {status.error && <span className="text-xs text-red-600">{status.error}</span>}
        {status.message && <span className="text-xs text-gray-500">{status.message}</span>}
      </div>
    </form>
  );
}

function Input({
  field,
  refs,
  value,
  form,
  disabled,
}: {
  field: Field;
  refs: Refs;
  value: unknown;
  form?: string;
  disabled?: boolean;
}) {
  const style =
    "w-full min-w-32 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-950";
  const common = { name: field.key, form, disabled, required: field.required };

  switch (field.type) {
    case "boolean":
      return <input type="checkbox" {...common} required={false} defaultChecked={Boolean(value)} />;
    case "ref":
      return (
        <select {...common} defaultValue={value == null ? "" : String(value)} className={style}>
          {!field.required && <option value="">–</option>}
          {field.required && value == null && (
            <option value="" disabled>
              Choose…
            </option>
          )}
          {Object.entries(refs[field.key] ?? {}).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      );
    case "textarea":
      return <textarea {...common} rows={3} defaultValue={value == null ? "" : String(value)} className={style} />;
    case "number":
      return <input type="number" {...common} defaultValue={value == null ? "" : String(value)} className={style} />;
    default:
      return <input type="text" {...common} defaultValue={value == null ? "" : String(value)} className={style} />;
  }
}

function Cell({ field, value, refs }: { field: Field; value: unknown; refs: Refs }) {
  if (value == null || value === "") return <span className="text-gray-400">–</span>;

  switch (field.type) {
    case "boolean":
      return <span>{value ? "✅" : "—"}</span>;
    case "datetime":
      return <span className="whitespace-nowrap text-gray-500">{formatDateTime(String(value))}</span>;
    case "ref":
      return <span>{refs[field.key]?.[String(value)] ?? `#${String(value)}`}</span>;
    default: {
      const text = String(value);
      if (field.key === "status") return <StatusBadge status={text} />;
      if (text.length <= LONG_TEXT) return <span className="whitespace-pre-wrap">{text}</span>;
      return (
        <details className="max-w-xl">
          <summary className="cursor-pointer">{text.slice(0, LONG_TEXT)}…</summary>
          <pre className="mt-2 font-sans text-xs whitespace-pre-wrap text-gray-600 dark:text-gray-400">{text}</pre>
        </details>
      );
    }
  }
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "succeeded"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : status === "failed"
        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{status}</span>;
}

function SmallButton({
  children,
  onClick,
  disabled,
  primary,
  danger,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  type?: "button" | "submit";
}) {
  const style = primary
    ? "bg-blue-600 text-white hover:bg-blue-700"
    : danger
      ? "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      : "border border-gray-300 hover:bg-white dark:border-gray-600 dark:hover:bg-gray-700";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 cursor-pointer rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}
