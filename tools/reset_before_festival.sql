-- 【当日朝に1回だけ実行】合算履歴のテストデータを全消去する
-- 対象プロジェクト: natsumatsuri (mwtbfyojclzdlfftrvhy)
-- 実行方法: Supabase → SQL Editor → 貼り付け → Run
--
-- ⚠️ これはオンライン合算用のデータだけを消します。
--    各iPad内の売上（IndexedDB）には影響しません。
--    本番の売上が入った後に実行すると、合算履歴が消えます（各iPadの記録は残ります）。

delete from public.nm_sales;

-- 確認用（0件になっていればOK）
select count(*) as 残り件数 from public.nm_sales;
