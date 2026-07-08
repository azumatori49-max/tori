-- ============================================================
-- Phase 1: マルチテナント化
-- Supabase の SQL Editor に「まるごと」貼り付けて実行してください。
--
--  - 組織（orgs）と所属（org_members）を導入し、レポートを組織ごとに分離
--  - 新規登録ユーザーは「組織を作成」or「招待コードで参加」
--  - 閲覧は組織ごとの閲覧用リンク（viewer_token）のみ。
--    旧「誰でも閲覧(anon select)」ポリシーは削除される
--  - 既存データは自動で最初の組織（"マイ組織"）に移行され、
--    既存ユーザー全員がその組織の admin として登録される
-- ============================================================

create extension if not exists "pgcrypto";

-- ── テーブル ─────────────────────────────────────────────
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  viewer_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table public.reports add column if not exists org_id uuid references public.orgs (id);
create index if not exists reports_org_idx on public.reports (org_id, created_at desc);

-- ── ヘルパー関数（RLSの再帰を避けるため security definer） ──
create or replace function public.my_org_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from org_members where user_id = auth.uid()
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members
    where org_id = p_org and user_id = auth.uid() and role = 'admin'
  )
$$;

-- ── RLS ──────────────────────────────────────────────────
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;

drop policy if exists "orgs_select" on public.orgs;
create policy "orgs_select" on public.orgs
  for select to authenticated using (id in (select public.my_org_ids()));

drop policy if exists "org_members_select" on public.org_members;
create policy "org_members_select" on public.org_members
  for select to authenticated using (org_id in (select public.my_org_ids()));

-- reports: 旧ポリシーを全て組織スコープに置き換え
drop policy if exists "reports_select" on public.reports;
drop policy if exists "reports_insert" on public.reports;
drop policy if exists "reports_update" on public.reports;
drop policy if exists "reports_delete" on public.reports;
drop policy if exists "reports_select_anon" on public.reports;

create policy "reports_select" on public.reports
  for select to authenticated using (org_id in (select public.my_org_ids()));
create policy "reports_insert" on public.reports
  for insert to authenticated with check (org_id in (select public.my_org_ids()));
create policy "reports_update" on public.reports
  for update to authenticated
  using (org_id in (select public.my_org_ids()))
  with check (org_id in (select public.my_org_ids()));
create policy "reports_delete" on public.reports
  for delete to authenticated using (org_id in (select public.my_org_ids()));

-- ── RPC（アプリから呼ぶ関数） ─────────────────────────────

-- 自分の所属組織（1つ目）を返す
create or replace function public.my_org()
returns table (id uuid, name text, role text, invite_code text, viewer_token text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, m.role, o.invite_code, o.viewer_token
  from org_members m join orgs o on o.id = m.org_id
  where m.user_id = auth.uid()
  order by m.created_at
  limit 1
$$;

-- 組織を新規作成（作成者は admin）
create or replace function public.create_org(org_name text)
returns table (id uuid, name text, role text, invite_code text, viewer_token text)
language plpgsql security definer set search_path = public as $$
declare v_org orgs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if length(trim(org_name)) = 0 then
    raise exception 'empty name';
  end if;
  insert into orgs (name) values (trim(org_name)) returning * into v_org;
  insert into org_members (org_id, user_id, role) values (v_org.id, auth.uid(), 'admin');
  return query select v_org.id, v_org.name, 'admin'::text, v_org.invite_code, v_org.viewer_token;
end $$;

-- 招待コードで組織に参加（member）
create or replace function public.join_org(code text)
returns table (id uuid, name text, role text, invite_code text, viewer_token text)
language plpgsql security definer set search_path = public as $$
declare v_org orgs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_org from orgs where invite_code = trim(code);
  if not found then
    raise exception 'invalid code';
  end if;
  insert into org_members (org_id, user_id, role)
    values (v_org.id, auth.uid(), 'member')
    on conflict (org_id, user_id) do nothing;
  return query
    select v_org.id, v_org.name, m.role, v_org.invite_code, v_org.viewer_token
    from org_members m where m.org_id = v_org.id and m.user_id = auth.uid();
end $$;

-- 招待コード／閲覧用リンクの再発行（adminのみ）
create or replace function public.rotate_org_code(p_org uuid, kind text)
returns table (id uuid, name text, role text, invite_code text, viewer_token text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'not admin';
  end if;
  if kind = 'invite' then
    update orgs set invite_code = encode(gen_random_bytes(6), 'hex') where orgs.id = p_org;
  elsif kind = 'viewer' then
    update orgs set viewer_token = encode(gen_random_bytes(16), 'hex') where orgs.id = p_org;
  else
    raise exception 'invalid kind';
  end if;
  return query
    select o.id, o.name, 'admin'::text, o.invite_code, o.viewer_token
    from orgs o where o.id = p_org;
end $$;

-- 閲覧用リンク: トークンから組織名を取得（未ログインでも可）
create or replace function public.get_org_by_viewer_token(t text)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from orgs where viewer_token = t
$$;

-- 閲覧用リンク: トークンからその組織のレポート一覧を取得（未ログインでも可）
create or replace function public.get_reports_by_viewer_token(t text)
returns setof public.reports
language sql stable security definer set search_path = public as $$
  select r.* from reports r
  join orgs o on o.id = r.org_id
  where o.viewer_token = t
  order by r.created_at desc
$$;

-- 権限
revoke all on function public.create_org(text) from public;
revoke all on function public.join_org(text) from public;
revoke all on function public.my_org() from public;
revoke all on function public.rotate_org_code(uuid, text) from public;
grant execute on function public.create_org(text) to authenticated;
grant execute on function public.join_org(text) to authenticated;
grant execute on function public.my_org() to authenticated;
grant execute on function public.rotate_org_code(uuid, text) to authenticated;
grant execute on function public.get_org_by_viewer_token(text) to anon, authenticated;
grant execute on function public.get_reports_by_viewer_token(text) to anon, authenticated;

-- ── 既存データの移行（組織が1つも無い場合のみ実行される） ──
do $$
declare v_org uuid;
begin
  if not exists (select 1 from orgs) then
    insert into orgs (name) values ('マイ組織') returning id into v_org;
    -- 既存の全ユーザー（旧viewerアカウントを除く）をadminとして所属させる
    insert into org_members (org_id, user_id, role)
      select v_org, u.id, 'admin'
      from auth.users u
      where coalesce(u.raw_app_meta_data ->> 'role', '') <> 'viewer'
      on conflict do nothing;
    -- 既存レポートを全てその組織に割り当て
    update reports set org_id = v_org where org_id is null;
  end if;
end $$;
