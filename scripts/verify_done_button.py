"""2026-09-28 「支払い完了」ボタンが全イベント・全カテゴリー・全画面サイズで
画面内に収まっているかを検証する。

⚠️ この検証が存在する理由:
  2026-08-24 法人iPad（1080x620）で「完了ボタンが画面下端で切れて押せない」と
  現場から報告が来た。2026-09-28 マルシェ対応で同じ端末に同じ症状を再発させた。
  既存の検証はどれも「ボタンが押せるか」を Playwright のクリックで見ていたが、
  Playwright は要素を自動でスクロールインしてからクリックするため、
  **人の指では押せない状態でも通ってしまう**（ネイト指摘）。
  そのため「クリックできたか」ではなく「画面内にあるか」を測る。

前提: ローカルで python3 -m http.server 8087 を起動しておく
実行:  python3 scripts/verify_done_button.py
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8087/index.html"
# 1080x620 は法人iPadの実測値（styles.css:433）。ここが本番。
SIZES = [(1080, 620), (1024, 535), (1366, 1024), (390, 844)]
ok = True
def check(cond, msg):
    global ok
    print(("OK  " if cond else "NG  ") + msg); ok = ok and cond

with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in SIZES:
        ctx = b.new_context(viewport={"width": w, "height": h})
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        pg.goto(URL); pg.wait_for_timeout(800)
        for ev in ["marche", "food", "drink"]:
            pg.click(f"[data-pick={ev}]"); pg.wait_for_timeout(450)
            cats = pg.evaluate("()=>[...document.querySelectorAll('[data-cat]')].map(b=>b.dataset.cat)") or [None]
            for c in cats:
                if c:
                    pg.click(f"[data-cat='{c}']"); pg.wait_for_timeout(200)
                m = pg.evaluate("""()=>{const b=document.querySelector('[data-done]').getBoundingClientRect();
                  return {bottom:b.bottom, top:b.top, h:b.height, vh:innerHeight}}""")
                over = m['bottom'] - m['vh']
                check(over <= 0.5,
                      f"[{w}x{h}] {ev}/{c or '-'} 支払い完了 bottom={m['bottom']:.0f} vh={m['vh']} はみ出し{over:+.0f}px")
            pg.click("[data-go='top']"); pg.wait_for_timeout(180)
        ctx.close()
    b.close()

print("\n==== " + ("ALL OK" if ok else "FAILED") + " ====")
sys.exit(0 if ok else 1)
