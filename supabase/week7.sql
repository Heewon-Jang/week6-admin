-- Week 7: admin panel with more observability.
-- Run this in Supabase Dashboard -> SQL Editor (after admin.sql).
-- Safe to run more than once.

-- 1. LLM providers and models -------------------------------------------------
create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  name text not null unique,
  base_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  provider_id bigint not null references public.llm_providers (id) on delete restrict,
  name text not null,
  api_model_id text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Prompt chains: the two-step chains the apps already run ------------------
create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  step_order int not null,
  name text not null,
  prompt_template text not null,
  output_format text not null default 'text',
  created_at timestamptz not null default now(),
  unique (chain_id, step_order)
);

-- How much of the caption traffic each chain gets, and how many captions it writes.
create table if not exists public.prompt_chain_mix (
  id bigint generated always as identity primary key,
  chain_id bigint not null unique references public.prompt_chains (id) on delete cascade,
  weight int not null default 1 check (weight between 0 and 100),
  caption_count int not null default 5 check (caption_count between 1 and 10),
  updated_at timestamptz not null default now()
);

-- 3. Humor terms and few-shot examples ----------------------------------------
create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null unique,
  definition text not null,
  example text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generation_examples (
  id bigint generated always as identity primary key,
  chain_id bigint references public.prompt_chains (id) on delete set null,
  input_description text not null,
  output_caption text not null,
  created_at timestamptz not null default now()
);

-- 4. Observability: one request per chain run, one response per LLM call ------
create table if not exists public.generation_requests (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  chain_id bigint references public.prompt_chains (id) on delete set null,
  image_id bigint references public.images (id) on delete set null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.llm_responses (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.generation_requests (id) on delete cascade,
  step_order int not null,
  model text not null,
  prompt text not null,
  response text,
  error text,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists llm_responses_request_id_idx on public.llm_responses (request_id);

-- 5. Who may sign up ------------------------------------------------------------
create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  domain text not null unique check (domain = lower(domain) and domain !~ '@'),
  created_at timestamptz not null default now()
);

create table if not exists public.whitelisted_emails (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+$'),
  created_at timestamptz not null default now()
);

-- 6. RLS: superadmins only, for every new table ---------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_steps',
    'prompt_chain_mix', 'terms', 'ai_generation_examples', 'generation_requests',
    'llm_responses', 'allowed_signup_domains', 'whitelisted_emails'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Superadmins manage %s" on public.%I', t, t);
    execute format(
      'create policy "Superadmins manage %s" on public.%I for all to authenticated '
      'using ((select public.is_superadmin())) with check ((select public.is_superadmin()))',
      t, t
    );
  end loop;
end $$;

-- 7. Seed with what the apps actually do today ----------------------------------
insert into public.llm_providers (name, base_url)
values ('Google Gemini', 'https://generativelanguage.googleapis.com/v1beta')
on conflict (name) do nothing;

insert into public.llm_models (provider_id, name, api_model_id)
select p.id, m.name, m.api_model_id
from public.llm_providers p,
  (values
    ('Gemini 3.8 Flash', 'gemini-3.8-flash'),
    ('Gemini 3.5 Flash', 'gemini-3.5-flash'),
    ('Gemini Flash (latest)', 'gemini-flash-latest')
  ) as m (name, api_model_id)
where p.name = 'Google Gemini'
on conflict (api_model_id) do nothing;

insert into public.prompt_chains (slug, name, description)
values
  ('photo', 'Photo captions', 'Image -> literal description -> grounded funny captions.'),
  ('headline', 'News headline captions', 'Today''s headlines -> pick the safest funny one -> captions.')
on conflict (slug) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, name, prompt_template, output_format)
select c.id, s.step_order, s.name, s.prompt_template, s.output_format
from public.prompt_chains c
join (values
  ('photo', 1, 'Describe the image',
   'Describe this image in 4-6 sentences. Cover the main subject first, then what is happening, the setting, notable objects, colors, facial expressions or body language, and any text visible in the image. Be specific and literal; only mention what is actually visible, and do not try to be funny. [+ optional uploader hint]',
   'text'),
  ('photo', 2, 'Write captions',
   'You write captions for a meme site for Columbia University students. [audience] Look at the attached image and write {count} short, funny captions (under 120 characters each) for it. [grounding rules] [style]\n\nA literal description of the image, to help you notice details:\n{description}',
   'json: string[]'),
  ('headline', 1, 'Pick a headline and write captions',
   'You write captions for a meme site for Columbia University students. [audience] Pick the ONE headline that is best for light-hearted humor (never death, violence, crime, illness, protests, war). Then write {count} short, funny captions reacting to it.\n\n{headlines}',
   'json: {index, captions[]}')
) as s (slug, step_order, name, prompt_template, output_format) on s.slug = c.slug
on conflict (chain_id, step_order) do nothing;

insert into public.prompt_chain_mix (chain_id, weight, caption_count)
select id, 1, 5 from public.prompt_chains
on conflict (chain_id) do nothing;

insert into public.allowed_signup_domains (domain)
values ('columbia.edu'), ('barnard.edu')
on conflict (domain) do nothing;

notify pgrst, 'reload schema';

-- Check: every table should show rls_enabled = true
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
