-- Evacua Database Schema for Supabase
-- Copy and paste this into your Supabase SQL Editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Plans table
create table if not exists public.plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled Plan',
  location text,
  description text,
  plan_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  
  constraint plan_name_not_empty check (length(name) > 0)
);

-- Index for faster lookups
create index if not exists idx_plans_user_id on public.plans(user_id);
create index if not exists idx_plans_updated_at on public.plans(updated_at desc);

-- Plan shares table (for collaboration)
create table if not exists public.plan_shares (
  id uuid default uuid_generate_v4() primary key,
  plan_id uuid not null references public.plans(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  shared_with_email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  
  constraint unique_share unique(plan_id, shared_with_email)
);

-- Index for faster lookups
create index if not exists idx_plan_shares_plan_id on public.plan_shares(plan_id);
create index if not exists idx_plan_shares_email on public.plan_shares(shared_with_email);

-- Activity log table (for tracking changes)
create table if not exists public.plan_activity (
  id uuid default uuid_generate_v4() primary key,
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null, -- 'created', 'updated', 'shared', 'deleted'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Index for activity log
create index if not exists idx_plan_activity_plan_id on public.plan_activity(plan_id);
create index if not exists idx_plan_activity_user_id on public.plan_activity(user_id);

-- Set up Row Level Security (RLS)
alter table public.plans enable row level security;
alter table public.plan_shares enable row level security;
alter table public.plan_activity enable row level security;

-- RLS Policies for plans
create policy "Users can view their own plans"
  on public.plans for select
  using (auth.uid() = user_id);

create policy "Users can create plans"
  on public.plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own plans"
  on public.plans for update
  using (auth.uid() = user_id);

create policy "Users can delete their own plans"
  on public.plans for delete
  using (auth.uid() = user_id);

-- RLS Policies for plan_shares
create policy "Users can view shares for their plans"
  on public.plan_shares for select
  using (auth.uid() = shared_by);

create policy "Users can create shares for their plans"
  on public.plan_shares for insert
  with check (auth.uid() = shared_by);

-- RLS Policies for plan_activity
create policy "Users can view activity for their plans"
  on public.plan_activity for select
  using (auth.uid() = user_id);

create policy "Users can create activity records"
  on public.plan_activity for insert
  with check (auth.uid() = user_id);
