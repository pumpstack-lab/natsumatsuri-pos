-- 夏祭りレジツール: 合算履歴用テーブル（2026-08-20）
-- 対象プロジェクト: natsumatsuri (mwtbfyojclzdlfftrvhy) — 祭り専用の空プロジェクト
-- ⚠️ CareStack本番DB (vqeoutrlvdydxenaspas) には絶対に入れないこと（residents/staff/reports 等の要配慮個人情報を持つ）。
-- 実行方法: Supabaseダッシュボード → SQL Editor → 全文貼り付け → Run

create table if not exists public.nm_sales (
  id          text primary key,
  terminal    text not null,
  seq         integer not null,
  items       jsonb not null,
  total       integer not null,
  received    integer,
  change      integer,
  vouchers    integer not null default 0,
  staff_name  text,
  payment     text not null default 'cash',
  status      text not null default 'active',
  edited      boolean not null default false,
  created_at  text not null,
  updated_at  text not null,
  synced_from text
);

alter table public.nm_sales enable row level security;

-- 祭りのiPad（anonキー）が読み書きできるようにする。
-- このプロジェクトには個人情報がなく、キーはリポジトリに含めず端末にのみ保存する。
drop policy if exists nm_sales_anon_select on public.nm_sales;
drop policy if exists nm_sales_anon_insert on public.nm_sales;
drop policy if exists nm_sales_anon_update on public.nm_sales;
create policy nm_sales_anon_select on public.nm_sales for select to anon using (true);
create policy nm_sales_anon_insert on public.nm_sales for insert to anon with check (true);
create policy nm_sales_anon_update on public.nm_sales for update to anon using (true) with check (true);
