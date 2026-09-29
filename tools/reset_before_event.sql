-- 【本番前に1回だけ実行】合算履歴から「これから使うイベント」のテストデータだけを消す
-- 対象プロジェクト: natsumatsuri (mwtbfyojclzdlfftrvhy)
-- 実行方法: Supabase → SQL Editor → 貼り付け → Run
--
-- ⚠️ これはオンライン合算用のデータだけを消します。各iPad内の売上には影響しません。
-- ⚠️ 2026-09-28 改訂: 以前は `delete from public.nm_sales;` で全消去しており、
--    マルシェのテストを消すつもりで9/19の祭りの合算データまで消える状態でした。
--    terminal で絞るようにしています。

-- ① まず中身を確認する（消す前に必ず目視する）
select terminal,
       count(*) as 件数,
       sum(total) as 売上合計,
       min(created_at) as 最初,
       max(created_at) as 最後
from public.nm_sales
group by terminal
order by terminal;

-- ② マルシェのテストデータだけを消す
--    （祭りの 'food' / 'drink' は残る）
delete from public.nm_sales where terminal = 'marche';

-- ③ 確認：marche が0件、祭りの分は残っていること
select terminal, count(*) as 残り件数
from public.nm_sales
group by terminal
order by terminal;
