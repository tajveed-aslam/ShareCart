-- ShareCart schema: profiles, shared lists, members and items, with Row Level Security so a list is only ever
-- visible to its members, and triggers that record who added/checked each item on the server (clients can't
-- spoof those columns). Run once in the Supabase SQL editor, or with `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------------------------------------------
-- Profiles: one per auth user (email or anonymous guest), holding the name shown to other members.
-- ---------------------------------------------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if name = '' then
    name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Guest');
  end if;
  insert into public.profiles (id, display_name) values (new.id, left(name, 40));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------------------------
-- Lists and membership
-- ---------------------------------------------------------------------------------------------------------------

-- 8 characters from a 31-letter alphabet without look-alikes (no 0/O, 1/I/L): easy to read out or type,
-- 31^8 ≈ 8.5 × 10^11 codes.
create or replace function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + (get_byte(b, i) % 31), 1), '')
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i
$$;

create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  invite_code text not null unique default public.new_invite_code(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.list_members (
  list_id   uuid not null references public.lists (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_id_idx on public.list_members (user_id);

-- Membership checks used by the policies. SECURITY DEFINER so they can read list_members without recursing into
-- list_members' own RLS policy.
create or replace function public.is_list_member(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.list_members where list_id = p_list_id and user_id = auth.uid())
$$;

create or replace function public.shares_a_list_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.list_members mine
    join public.list_members theirs on theirs.list_id = mine.list_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  )
$$;

-- The creator of a list becomes its owner-member automatically.
create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.list_members (list_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_list_created
  after insert on public.lists
  for each row execute function public.add_owner_membership();

-- Owner and invite code can't be changed with a plain UPDATE (rotate the code with regenerate_invite_code()).
create or replace function public.protect_list_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.owner_id := old.owner_id;
  if current_setting('sharecart.rotating_invite', true) is distinct from 'on' then
    new.invite_code := old.invite_code;
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger before_list_update
  before update on public.lists
  for each row execute function public.protect_list_columns();

-- ---------------------------------------------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------------------------------------------
create table public.items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  quantity   text check (quantity is null or char_length(quantity) <= 30),
  barcode    text check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,64}$'),
  checked    boolean not null default false,
  added_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_list_id_idx on public.items (list_id);

-- Who added / checked an item is decided here from the caller's JWT, never taken from the client.
create or replace function public.stamp_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.added_by := auth.uid();
    new.created_at := now();
    if new.checked then
      new.checked_by := auth.uid();
      new.checked_at := now();
    else
      new.checked_by := null;
      new.checked_at := null;
    end if;
  else
    new.list_id := old.list_id;
    new.added_by := old.added_by;
    new.created_at := old.created_at;
    if new.checked is distinct from old.checked then
      new.checked_by := case when new.checked then auth.uid() end;
      new.checked_at := case when new.checked then now() end;
    else
      new.checked_by := old.checked_by;
      new.checked_at := old.checked_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger before_item_write
  before insert or update on public.items
  for each row execute function public.stamp_item();

-- ---------------------------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.items enable row level security;

create policy "profiles: read self and people you share a list with" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_a_list_with(id));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- `owner_id = auth.uid()` matters on create: INSERT ... RETURNING is checked against this policy before the
-- trigger that adds the owner's membership row has run.
create policy "lists: members read" on public.lists
  for select to authenticated using (owner_id = auth.uid() or public.is_list_member(id));
create policy "lists: create your own" on public.lists
  for insert to authenticated with check (owner_id = auth.uid());
create policy "lists: members rename" on public.lists
  for update to authenticated using (public.is_list_member(id)) with check (public.is_list_member(id));
create policy "lists: owner deletes" on public.lists
  for delete to authenticated using (owner_id = auth.uid());

-- Joining goes through join_list() (needs the invite code), so there is no INSERT policy on list_members.
create policy "members: members read" on public.list_members
  for select to authenticated using (public.is_list_member(list_id));
create policy "members: leave, or owner removes" on public.list_members
  for delete to authenticated using (
    (user_id = auth.uid() and role <> 'owner')
    or exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid() and user_id <> auth.uid())
  );

create policy "items: members read" on public.items
  for select to authenticated using (public.is_list_member(list_id));
create policy "items: members add" on public.items
  for insert to authenticated with check (public.is_list_member(list_id));
create policy "items: members update" on public.items
  for update to authenticated using (public.is_list_member(list_id)) with check (public.is_list_member(list_id));
create policy "items: members delete" on public.items
  for delete to authenticated using (public.is_list_member(list_id));

-- ---------------------------------------------------------------------------------------------------------------
-- RPCs for joining by invite code
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'))
$$;

-- What an invite is for, so the join screen can say "Join 'Weekly shop' from Ayesha?" before joining.
create or replace function public.invite_preview(p_code text)
returns table (list_id uuid, list_name text, owner_name text, member_count bigint, already_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.name, p.display_name,
         (select count(*) from public.list_members m where m.list_id = l.id),
         public.is_list_member(l.id)
  from public.lists l
  join public.profiles p on p.id = l.owner_id
  where auth.uid() is not null and l.invite_code = public.normalize_invite_code(p_code)
$$;

create or replace function public.join_list(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join a list' using errcode = '28000';
  end if;
  select id into target from public.lists where invite_code = public.normalize_invite_code(p_code);
  if target is null then
    raise exception 'That invite code is not valid' using errcode = 'P0002';
  end if;
  insert into public.list_members (list_id, user_id, role) values (target, auth.uid(), 'member')
  on conflict (list_id, user_id) do nothing;
  return target;
end;
$$;

-- Owner-only: issue a new code so old invite links stop working.
create or replace function public.regenerate_invite_code(p_list_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not exists (select 1 from public.lists where id = p_list_id and owner_id = auth.uid()) then
    raise exception 'Only the list owner can reset the invite code' using errcode = '42501';
  end if;
  perform set_config('sharecart.rotating_invite', 'on', true);
  update public.lists set invite_code = public.new_invite_code() where id = p_list_id returning invite_code into code;
  perform set_config('sharecart.rotating_invite', 'off', true);
  return code;
end;
$$;

-- Signed-out (anon) callers get none of the RPCs.
revoke execute on function public.is_list_member(uuid) from public, anon;
revoke execute on function public.shares_a_list_with(uuid) from public, anon;
revoke execute on function public.invite_preview(text) from public, anon;
revoke execute on function public.join_list(text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.shares_a_list_with(uuid) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.join_list(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Realtime: stream row changes (RLS applies, so members only receive their own lists' changes).
-- ---------------------------------------------------------------------------------------------------------------
alter table public.items replica identity full;
alter table public.list_members replica identity full;
alter publication supabase_realtime add table public.items, public.lists, public.list_members;
