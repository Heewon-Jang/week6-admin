// Every table the generic admin pages can show, and what a superadmin may do
// with it. Server Actions look tables up here, so the client can never name
// a table or column that isn't listed.

export type FieldType = "text" | "textarea" | "number" | "boolean" | "ref" | "datetime";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  // Editable fields appear in the create/edit forms; the rest are display-only.
  editable?: boolean;
  required?: boolean;
  // For "ref": the table it points at and the column to show instead of the id.
  ref?: { table: string; label: string };
};

export type Resource = {
  slug: string;
  table: string;
  title: string;
  description: string;
  fields: Field[];
  can: { create?: boolean; update?: boolean; delete?: boolean };
};

const createdAt: Field = { key: "created_at", label: "Created", type: "datetime" };
const chain: Field = {
  key: "chain_id",
  label: "Chain",
  type: "ref",
  ref: { table: "prompt_chains", label: "name" },
};

export const RESOURCES: Resource[] = [
  {
    slug: "prompt-chains",
    table: "prompt_chains",
    title: "Prompt chains",
    description: "The multi-step LLM pipelines the apps run. They mirror the code.",
    fields: [
      { key: "slug", label: "Slug", type: "text" },
      { key: "name", label: "Name", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      createdAt,
    ],
    can: {},
  },
  {
    slug: "prompt-chain-steps",
    table: "prompt_chain_steps",
    title: "Prompt chain steps",
    description: "Each LLM call in a chain, in order, with its prompt template.",
    fields: [
      chain,
      { key: "step_order", label: "Step", type: "number" },
      { key: "name", label: "Name", type: "text" },
      { key: "prompt_template", label: "Prompt template", type: "textarea" },
      { key: "output_format", label: "Output", type: "text" },
    ],
    can: {},
  },
  {
    slug: "prompt-chain-mix",
    table: "prompt_chain_mix",
    title: "Prompt chain mix",
    description: "How much traffic each chain gets (weight 0–100) and how many captions it writes.",
    fields: [
      chain,
      { key: "weight", label: "Weight", type: "number", editable: true, required: true },
      { key: "caption_count", label: "Captions", type: "number", editable: true, required: true },
      { key: "updated_at", label: "Updated", type: "datetime" },
    ],
    can: { update: true },
  },
  {
    slug: "terms",
    table: "terms",
    title: "Terms",
    description: "Slang and campus terms the caption writer should understand.",
    fields: [
      { key: "term", label: "Term", type: "text", editable: true, required: true },
      { key: "definition", label: "Definition", type: "textarea", editable: true, required: true },
      { key: "example", label: "Example", type: "textarea", editable: true },
      createdAt,
    ],
    can: { create: true, update: true, delete: true },
  },
  {
    slug: "generation-examples",
    table: "ai_generation_examples",
    title: "AI generation examples",
    description: "Few-shot examples: an image description and a caption that landed.",
    fields: [
      { ...chain, editable: true },
      { key: "input_description", label: "Input description", type: "textarea", editable: true, required: true },
      { key: "output_caption", label: "Output caption", type: "textarea", editable: true, required: true },
      createdAt,
    ],
    can: { create: true, update: true, delete: true },
  },
  {
    slug: "generation-requests",
    table: "generation_requests",
    title: "Generation requests",
    description: "One row per prompt chain run from the admin area, with its outcome.",
    fields: [
      { key: "id", label: "ID", type: "number" },
      chain,
      { key: "user_id", label: "Requested by", type: "ref", ref: { table: "profiles", label: "email" } },
      { key: "image_id", label: "Image", type: "number" },
      { key: "status", label: "Status", type: "text" },
      { key: "error", label: "Error", type: "textarea" },
      createdAt,
      { key: "finished_at", label: "Finished", type: "datetime" },
    ],
    can: {},
  },
  {
    slug: "llm-responses",
    table: "llm_responses",
    title: "LLM responses",
    description: "Every LLM call: the exact prompt, the raw response, the model and how long it took.",
    fields: [
      { key: "request_id", label: "Request", type: "number" },
      { key: "step_order", label: "Step", type: "number" },
      { key: "model", label: "Model", type: "text" },
      { key: "latency_ms", label: "ms", type: "number" },
      { key: "prompt", label: "Prompt", type: "textarea" },
      { key: "response", label: "Response", type: "textarea" },
      { key: "error", label: "Error", type: "textarea" },
      createdAt,
    ],
    can: {},
  },
  {
    slug: "llm-models",
    table: "llm_models",
    title: "LLM models",
    description: "Models available to the prompt chains.",
    fields: [
      {
        key: "provider_id",
        label: "Provider",
        type: "ref",
        ref: { table: "llm_providers", label: "name" },
        editable: true,
        required: true,
      },
      { key: "name", label: "Name", type: "text", editable: true, required: true },
      { key: "api_model_id", label: "API model ID", type: "text", editable: true, required: true },
      { key: "is_active", label: "Active", type: "boolean", editable: true },
      createdAt,
    ],
    can: { create: true, update: true, delete: true },
  },
  {
    slug: "llm-providers",
    table: "llm_providers",
    title: "LLM providers",
    description: "Companies whose models we call. A provider with models can't be deleted.",
    fields: [
      { key: "name", label: "Name", type: "text", editable: true, required: true },
      { key: "base_url", label: "Base URL", type: "text", editable: true },
      createdAt,
    ],
    can: { create: true, update: true, delete: true },
  },
  {
    slug: "signup-domains",
    table: "allowed_signup_domains",
    title: "Allowed signup domains",
    description: "Email domains allowed to sign up, e.g. columbia.edu (no @).",
    fields: [
      { key: "domain", label: "Domain", type: "text", editable: true, required: true },
      createdAt,
    ],
    can: { create: true, update: true, delete: true },
  },
  {
    slug: "whitelisted-emails",
    table: "whitelisted_emails",
    title: "Whitelisted e-mail addresses",
    description: "Individual addresses allowed in even if their domain isn't.",
    fields: [
      { key: "email", label: "Email", type: "text", editable: true, required: true },
      createdAt,
    ],
    can: { create: true, update: true, delete: true },
  },
];

export function getResource(slug: string) {
  return RESOURCES.find((r) => r.slug === slug);
}

// Lower-cased on save so the unique constraints catch duplicates.
const LOWERCASE_FIELDS = new Set(["domain", "email"]);

// Turns submitted form data into a row, using only the resource's editable fields.
export function parseRow(resource: Resource, formData: FormData) {
  const row: Record<string, string | number | boolean | null> = {};
  for (const field of resource.fields.filter((f) => f.editable)) {
    const raw = formData.get(field.key);
    if (field.type === "boolean") {
      row[field.key] = raw === "on";
      continue;
    }
    let value = String(raw ?? "").trim();
    if (LOWERCASE_FIELDS.has(field.key)) value = value.toLowerCase();
    if (!value) {
      if (field.required) throw new Error(`${field.label} is required.`);
      row[field.key] = null;
    } else if (field.type === "number" || field.type === "ref") {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`${field.label} must be a number.`);
      row[field.key] = n;
    } else {
      row[field.key] = value;
    }
  }
  return row;
}
