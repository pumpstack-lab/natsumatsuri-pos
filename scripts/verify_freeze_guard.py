"""2026-10-03 「途中でボタンが何も反応しなくなり、閉じて開いたら戻った」（10/2 現場）の守りを検証する。

⚠️ この検証が存在する理由:
  iPad内の保存（IndexedDB）が
    A. 成功も失敗も返さず止まる → 二重登録防止フラグが立ったままになり「支払い完了」が永久に無反応
    B. 接続が切れる            → 「保存できませんでした」が開き直すまで出続ける
  の2つを修正前のコードで再現した（今回の原因と確定したわけではない）。
  修正後は A・B とも、もう一度押せば同じ会計が1件だけ登録されることを測る。
  あわせて、診断記録が残ること・オフライン起動できること・連続会計で遅くならないことを見る。

前提: ローカルで python3 -m http.server 8087 を起動しておく
実行:  python3 scripts/verify_freeze_guard.py
"""
import sys
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8087/index.html"
ok = True


def check(cond, msg):
    global ok
    print(("OK  " if cond else "NG  ") + msg)
    ok = ok and cond


# 開いたDB接続を全部控えておき、あとで「iPad側で切れた」を db.close() で再現する
INIT = """
(() => {
  window.__dbs = [];
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...a) {
    const req = open.apply(this, a);
    req.addEventListener('success', () => window.__dbs.push(req.result));
    return req;
  };
})();
"""

# 書き込みは実際に行うが、完了の知らせだけ届かない（＝アプリから見ると止まっている）状態
HANG = """() => {
  window.__origTx = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (...a) {
    const real = window.__origTx.apply(this, a);
    if (a[1] !== 'readwrite') return real;
    return { objectStore: (n) => real.objectStore(n), set oncomplete(f) {}, set onerror(f) {}, set onabort(f) {} };
  };
}"""
UNHANG = "() => { IDBDatabase.prototype.transaction = window.__origTx; }"

COUNT_SALES = """async () => {
  const db = await new Promise((r) => { const q = indexedDB.open('natsumatsuri-pos'); q.onsuccess = () => r(q.result); });
  const all = await new Promise((r) => { const q = db.transaction('sales').objectStore('sales').getAll(); q.onsuccess = () => r(q.result); });
  db.close();
  return all.filter((s) => s.status === 'active').map((s) => s.terminal + '-' + s.seq + '-' + s.total);
}"""


def new_page(b, ctx=None):
    ctx = ctx or b.new_context(viewport={"width": 1180, "height": 820})
    ctx.add_init_script(INIT)
    pg = ctx.new_page()
    dialogs = []
    pg.on("dialog", lambda d: (dialogs.append(d.message.split("\n")[0]), d.accept()))
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(1200)
    pg.click('[data-pick="marche"]')
    pg.wait_for_timeout(400)
    return ctx, pg, dialogs, errors


def ring_up(pg, wait=800):
    pg.locator("[data-add]").first.click()
    pg.locator('[data-cash="1000"]').click()
    pg.locator("[data-done]").click()
    pg.wait_for_timeout(wait)
    return pg.locator(".cart__empty").count() == 1


with sync_playwright() as p:
    b = p.chromium.launch()

    # --- A: 保存が返ってこない ---
    ctx, pg, dialogs, errors = new_page(b)
    check(ring_up(pg), "A 通常の会計が登録できる")
    pg.evaluate(HANG)
    pg.locator("[data-add]").first.click()
    pg.locator('[data-cash="1000"]').click()
    pg.locator("[data-done]").click()
    pg.wait_for_timeout(6500)  # 打ち切り 5秒 ＋余裕
    check(any("保存できませんでした" in d for d in dialogs), "A 止まった保存は5秒で打ち切られ、知らせが出る（以前は無反応のまま）")
    check(pg.locator(".cart__row").count() == 1, "A 伝票は消えずに残っている")
    check(not pg.locator("[data-done]").is_disabled(), "A 支払い完了がまた押せる")
    pg.evaluate(UNHANG)
    pg.locator("[data-done]").click()
    pg.wait_for_timeout(800)
    check(pg.locator(".cart__empty").count() == 1, "A もう一度押すと登録できる")
    sales = pg.evaluate(COUNT_SALES)
    check(len(sales) == 2 and len(set(sales)) == 2,
          f"A 裏で遅れて書けていても二重登録にならない（会計 {len(sales)}件: {sales}）")
    check(ring_up(pg), "A その後の会計も普通に通る")
    ctx.close()

    # --- B: 接続が切れる（iPad側で閉じられた状態を db.close() で再現） ---
    ctx, pg, dialogs, errors = new_page(b)
    check(ring_up(pg), "B 通常の会計が登録できる")
    pg.evaluate("() => window.__dbs.forEach((d) => d.close())")
    n_dialogs = len(dialogs)
    check(ring_up(pg), "B 接続が切れていても、1回の押下で登録できる（自動で開き直す）")
    check(len(dialogs) == n_dialogs, f"B 職員に「保存できませんでした」を見せない {dialogs[n_dialogs:]}")
    check(ring_up(pg), "B その後の会計も普通に通る")
    sales = pg.evaluate(COUNT_SALES)
    check(len(sales) == 3, f"B 会計はちょうど3件（{len(sales)}件）")

    # --- 診断記録 ---
    pg.click('[data-go="top"]')
    pg.wait_for_timeout(300)
    pg.click("[data-diag]")
    pg.wait_for_timeout(300)
    kinds = pg.evaluate("() => [...document.querySelectorAll('.diag__k')].map((e) => e.textContent)")
    for k in ["起動", "押した", "触れた", "保存開始", "保存完了"]:
        check(k in kinds, f"診断 「{k}」が記録されている")
    check("DB作り直し" in kinds or "保存失敗" in kinds, "診断 接続切れ（作り直し／失敗）が記録されている")
    check(errors == [], f"画面のエラーなし {errors[:3]}")
    ctx.close()

    # --- オフライン起動（新しく足したファイルを含めて立ち上がるか） ---
    ctx = b.new_context(viewport={"width": 1180, "height": 820})
    pg = ctx.new_page()
    pg.goto(URL)
    pg.wait_for_timeout(2500)  # SW のインストール待ち
    pg.reload()
    pg.wait_for_timeout(1000)
    ctx.set_offline(True)
    pg.reload()
    pg.wait_for_timeout(1500)
    ver = pg.locator(".top__ver").inner_text() if pg.locator(".top__ver").count() else "(表示なし)"
    check("フリーズ対策" in ver, f"オフライン起動で新しい版が立ち上がる（{ver.strip()}）")
    pg.on("dialog", lambda d: d.accept())
    pg.click('[data-pick="marche"]')
    pg.wait_for_timeout(400)
    check(ring_up(pg), "オフラインでも会計できる")
    pg.click('[data-go="top"]')
    pg.wait_for_timeout(300)
    pg.click("[data-diag]")
    pg.wait_for_timeout(300)
    check(pg.locator(".diag__row").count() > 0, "オフラインでも診断画面が開く")
    ctx.close()

    # --- 連続会計で遅くならない（記録を足した分の負担） ---
    ctx, pg, dialogs, errors = new_page(b)
    times = []
    for n in range(150):
        t = time.time()
        if not ring_up(pg, wait=0):
            pg.wait_for_function("document.querySelector('.cart__empty') !== null", timeout=3000)
        times.append((time.time() - t) * 1000)
    first10 = sum(times[:10]) / 10
    last10 = sum(times[-10:]) / 10
    check(last10 < first10 * 1.5 + 50, f"150会計後も遅くならない（最初10件 平均{first10:.0f}ms → 最後10件 {last10:.0f}ms）")
    size = pg.evaluate("() => (localStorage.getItem('komoreji_diag') || '').length")
    check(size < 600_000, f"診断記録の大きさ {size:,} 文字（上限2000件）")
    ctx.close()
    b.close()

print("ALL OK" if ok else "NG あり")
sys.exit(0 if ok else 1)
