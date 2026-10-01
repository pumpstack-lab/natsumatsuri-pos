-- 【全消去】合算履歴の売上を**すべて**消す（2026-10-01 オーナー指示）
-- 対象プロジェクト: natsumatsuri (mwtbfyojclzdlfftrvhy)
-- 実行方法: Supabase → SQL Editor → 貼り付け → 1ブロックずつ Run
--
-- ⚠️ これは 9/19 の祭り（food / drink）の記録も消します。戻せません。
-- ⚠️ マルシェのテストだけ消したい時は reset_before_event.sql を使うこと。
-- ⚠️ これはオンライン合算用のデータだけを消します。各iPad内の売上は別途アプリで消す。

-- ① まず中身を確認する（消す前に必ず目視する）
select terminal,
       count(*) as 件数,
       sum(total) as 売上合計,
       min(created_at) as 最初,
       max(created_at) as 最後
from public.nm_sales
group by terminal
order by terminal;

-- ② 【保険】消す前に中身をまるごと控える。
--    気が変わった時・消しすぎた時はこのテーブルから戻せる。
--    不要になったら drop table public.nm_sales_backup_20261001; で消す。
create table if not exists public.nm_sales_backup_20261001 as
select * from public.nm_sales;

--    控えが取れたことを確認（元の件数と一致すること）
select (select count(*) from public.nm_sales)                  as 元の件数,
       (select count(*) from public.nm_sales_backup_20261001)  as 控えた件数;

-- ③ ②の2つの件数が一致していることを確認してから、ここを実行する
delete from public.nm_sales;

-- ④ 確認：0件になっていること
select count(*) as 残り件数 from public.nm_sales;
