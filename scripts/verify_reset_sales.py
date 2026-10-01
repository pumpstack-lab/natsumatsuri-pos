"""2026-09-16 祭り前リセット（この端末の売上を全消去）の描画・動作検証。
python3 scripts/verify_reset_sales.py  (ローカルで python3 -m http.server 8087 を起動しておく)
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8087/index.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
ok = True


def check(cond, msg):
    global ok
    print(("OK  " if cond else "NG  ") + msg)
    ok = ok and cond


def db_counts(pg):
    return pg.evaluate(
        """()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');r.onsuccess=()=>{
            const db=r.result;const names=[...db.objectStoreNames];const tx=db.transaction(names,'readonly');
            const out={};let pending=names.length;
            names.forEach(n=>{const q=tx.objectStore(n).getAll();q.onsuccess=()=>{out[n]=q.result;if(--pending===0)res(out)}});
        }})"""
    )


def register_sale(pg):
    pg.click("[data-pick=food]")
    pg.wait_for_timeout(300)
    pg.click("[data-add]")
    pg.click("[data-done]")
    pg.wait_for_timeout(300)
    pg.click("[data-go=top]")
    pg.wait_for_timeout(200)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1080, "height": 720})
    pg = ctx.new_page()
    dialogs = []

    def on_dialog(d):
        dialogs.append(d.message)
        if d.type == "confirm":
            d.accept()
        elif d.type == "prompt":
            d.accept("削除")
        else:
            d.accept()

    pg.on("dialog", on_dialog)
    pg.goto(URL)
    pg.wait_for_timeout(500)

    # クリーンスタート
    pg.evaluate(
        """()=>new Promise(res=>{const r=indexedDB.deleteDatabase('natsumatsuri-pos');r.onsuccess=()=>res();r.onerror=()=>res();r.onblocked=()=>res()})"""
    )
    pg.reload()
    pg.wait_for_timeout(600)

    # 売上2件登録（フード）
    register_sale(pg)
    register_sale(pg)
    before = db_counts(pg)
    check(len(before.get("sales", [])) == 2, f"事前: sales=2件 実際={len(before.get('sales', []))}")
    n_products_before = len(before.get("products", []))
    check(n_products_before > 0, f"事前: 商品が入っている 実際={n_products_before}件")

    # 書き出し画面へ
    pg.click("[data-go=export]")
    pg.wait_for_timeout(300)

    btn_disabled = pg.get_attribute("[data-clear-sales]", "disabled")
    check(btn_disabled is None, "売上2件あり: ボタンは有効")

    # --- 不一致入力ケース（先に確認: 消えないこと） ---
    dialogs.clear()

    def on_dialog_mismatch(d):
        dialogs.append((d.type, d.message))
        if d.type == "confirm":
            d.accept()
        elif d.type == "prompt":
            d.accept("けす")
        else:
            d.accept()

    pg.remove_listener("dialog", on_dialog)
    pg.on("dialog", on_dialog_mismatch)
    pg.click("[data-clear-sales]")
    pg.wait_for_timeout(300)
    after_mismatch = db_counts(pg)
    check(len(after_mismatch.get("sales", [])) == 2, f"不一致入力: sales消えず2件のまま 実際={len(after_mismatch.get('sales', []))}")

    # --- 正しい入力ケース ---
    pg.remove_listener("dialog", on_dialog_mismatch)
    pg.on("dialog", on_dialog)
    pg.click("[data-clear-sales]")
    pg.wait_for_timeout(400)

    after = db_counts(pg)
    check(len(after.get("sales", [])) == 0, f"消去後: sales=0件 実際={len(after.get('sales', []))}")
    # 売上消去で商品マスタが増減しないことが要点。件数の直書きは seed 更新で陳腐化する
    check(len(after.get("products", [])) == n_products_before,
          f"消去後: 商品は{n_products_before}件のまま 実際={len(after.get('products', []))}")
    meta = {m["key"]: m["value"] for m in after.get("meta", [])}
    check(meta.get("terminal") == "food", f"消去後: meta.terminal='food'が残る 実際={meta.get('terminal')}")
    check("last_sync_at" not in meta, f"消去後: last_sync_atが無い 実際にある値={meta.get('last_sync_at')}")

    pg.wait_for_timeout(300)
    btn_disabled2 = pg.get_attribute("[data-clear-sales]", "disabled")
    check(btn_disabled2 is not None, "消去後(0件): ボタンがdisabled")

    pg.screenshot(path=f"{OUT}/export_after_clear.png")

    # 消去後にレジ画面で新規登録でき、連番が1組目に戻るか
    pg.click("[data-go=top]")
    pg.wait_for_timeout(200)
    pg.click("[data-pick=food]")
    pg.wait_for_timeout(300)
    pg.click("[data-add]")
    pg.click("[data-done]")
    pg.wait_for_timeout(300)
    latest_seq = pg.evaluate(
        """()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');r.onsuccess=()=>{
            const q=r.result.transaction('sales').objectStore('sales').getAll();
            q.onsuccess=()=>{const rows=q.result;rows.sort((a,b)=>b.created_at.localeCompare(a.created_at));res(rows[0].seq)}
        }})"""
    )
    check(latest_seq == 1, f"消去後の新規登録: 顧客連番が1組目に戻る 実際={latest_seq}")

    ctx.close()
    b.close()

print("ALL OK" if ok else "SOME NG")
sys.exit(0 if ok else 1)
