-- 店長ダッシュボード スキーマ
-- Supabase の SQL Editor で実行してください。
-- アプリはサーバー側から service_role キーでアクセスするため、
-- 全テーブルで RLS を有効化し、匿名アクセスは遮断します。

create extension if not exists pgcrypto;

-- ===== 店舗 =====
create table if not exists stores (
	id uuid primary key default gen_random_uuid(),
	code text not null unique,
	name text not null,
	brand text not null default '鶏ヤロー・まる助',
	-- lib/auth.ts の hashPassword() が生成する `salt:hash` 形式
	password_hash text,
	active boolean not null default true,
	created_at timestamptz not null default now()
);

-- ===== 日次 KPI(GAS から同期)=====
create table if not exists daily_metrics (
	store_id uuid not null references stores(id) on delete cascade,
	date date not null,
	kpi_score numeric not null,
	kpi_avg numeric,
	overall_rank integer not null,
	total_stores integer not null,
	cost_rate numeric not null,
	cost_rate_rank integer,
	cost_rate_target numeric,
	cost_rate_avg numeric,
	labor_rate numeric not null,
	labor_rate_rank integer,
	labor_rate_target numeric,
	labor_rate_avg numeric,
	qsc_score numeric,
	qsc_rank integer,
	qsc_prev_rank integer,
	updated_at timestamptz not null default now(),
	primary key (store_id, date)
);

create index if not exists daily_metrics_date_idx on daily_metrics (date desc);

-- ===== 衛生チェック提出状況(店舗ごとに最新 1 件)=====
create table if not exists hygiene_status (
	store_id uuid primary key references stores(id) on delete cascade,
	date date not null,
	daily_submitted integer not null default 0,
	daily_required integer not null default 7,
	weekly_submitted integer not null default 0,
	weekly_required integer not null default 7,
	last_submitted_at timestamptz
);

-- ===== コメント(本部管理画面から投稿)=====
create table if not exists comments (
	id uuid primary key default gen_random_uuid(),
	store_id uuid references stores(id) on delete cascade, -- null = 全店舗宛て
	author_name text not null,
	author_role text not null check (author_role in ('am', 'sv', 'hq')),
	body text not null,
	created_at timestamptz not null default now()
);

create index if not exists comments_store_idx on comments (store_id, created_at desc);

-- ===== お知らせ(本部管理画面から配信)=====
create table if not exists announcements (
	id uuid primary key default gen_random_uuid(),
	title text not null,
	link_url text,
	published_at timestamptz not null default now()
);

-- ===== RLS: anon キーからのアクセスを全面的に遮断 =====
alter table stores enable row level security;
alter table daily_metrics enable row level security;
alter table hygiene_status enable row level security;
alter table comments enable row level security;
alter table announcements enable row level security;

-- ===== サンプル店舗(コードと名前は実店舗に合わせて変更)=====
-- パスワードはアプリの scripts/hash-password.mjs で生成して更新してください。
insert into stores (code, name, brand) values
	('101', '福島栄町店', '鶏ヤロー・まる助'),
	('102', '郡山駅前店', '鶏ヤロー'),
	('103', 'いわき平店', '鶏ヤロー')
on conflict (code) do nothing;
