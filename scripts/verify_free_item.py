"""「その他」＝その場で金額を決めて売る機能を実測する（2026-10-01 オーナー要望）。

検証する事故シナリオ:
  1. 全カテゴリーで**スクロールせずに押せる**か。
     ⚠️ 最初は商品の末尾に置いていたが、「すべて」では32品ぶんスクロールしないと
        出てこず、行列の中では使えなかった（実測で発見）→ 先頭に移した。
  2. 金額だけ入力（商品名は空）でも登録できるか。カテゴリー名で入るか。
  3. カンマ付き・全角の金額が化けないか（parsePriceInput 経由）。
  4. 同じ金額を2回押した時に別行になるか（違う品物なのでまとめない）。
  5. 無効な金額を弾くか。
  6. 会計まで通した時、カテゴリー付きで保存され、**商品マスタを汚さない**か。

前提: python3 -m http.server 8087
"""
from playwright.sync_api import sync_playwright
ok = True
def check(c, m):
    global ok
    print(("OK  " if c else "NG  ") + m)
    ok = ok and c

def fresh(p, answers):
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 1080, "height": 620}).new_page()
    seq = list(answers)
    pg.on("dialog", lambda d: d.accept(seq.pop(0) if seq and d.type == "prompt" else ""))
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(1100)
    pg.click("text=マルシェ"); pg.wait_for_timeout(700)
    return b, pg

with sync_playwright() as p:
    # ① 全カテゴリーでスクロールせず押せる
    b, pg = fresh(p, [])
    for cat, sel in [("すべて", ".cattabs button:has-text('すべて')"), ("レスポ", ".cattabs button[data-cat='レスポ']"),
                     ("こもあん", ".cattabs button[data-cat='こもあん']"), ("こもれび", ".cattabs button[data-cat='こもれび']"),
                     ("ベーカリー", ".cattabs button[data-cat='ベーカリー']"), ("B型", ".cattabs button[data-cat='B型']")]:
        pg.click(sel); pg.wait_for_timeout(450)
        r = pg.evaluate("""()=>{const g=document.querySelector('.reg__grid');const gr=g.getBoundingClientRect();
          const f=g.querySelector('[data-free]');const fb=f.getBoundingClientRect();
          return fb.bottom<=gr.bottom+1&&fb.top>=gr.top-1;}""")
        check(r, f"{cat}: 「＋ その他」がスクロールせずに押せる")
    b.close()

    # ② 金額だけ（名前は空）→ カテゴリー名で入る
    b, pg = fresh(p, ["350", ""])
    pg.click(".cattabs button[data-cat='こもれび']"); pg.wait_for_timeout(400)
    pg.click("[data-free]"); pg.wait_for_timeout(800)
    it = pg.evaluate("()=>[...document.querySelectorAll('.cart__list *')].map(e=>e.textContent.trim()).join(' | ')")
    t = pg.evaluate("()=>document.querySelector('.cart__total strong')?.textContent.replace(/[^\\d]/g,'')")
    check(t == "350", f"金額だけ入力で¥350計上（実測¥{t}）")
    check("こもれび その他" in it, "名前が空なら「こもれび その他」で入る")
    b.close()

    # ③ カンマ付き＋商品名あり
    b, pg = fresh(p, ["1,200", "手作りポーチ"])
    pg.click(".cattabs button[data-cat='こもれび']"); pg.wait_for_timeout(400)
    pg.click("[data-free]"); pg.wait_for_timeout(800)
    it = pg.evaluate("()=>[...document.querySelectorAll('.cart__list *')].map(e=>e.textContent.trim()).join(' | ')")
    t = pg.evaluate("()=>document.querySelector('.cart__total strong')?.textContent.replace(/[^\\d]/g,'')")
    check(t == "1200", f"カンマ付き「1,200」が¥1,200（実測¥{t}）")
    check("手作りポーチ" in it, "入力した商品名で入る")
    b.close()

    # ④ 同じ金額2回＝別行
    b, pg = fresh(p, ["300", "", "300", ""])
    pg.click(".cattabs button[data-cat='ベーカリー']"); pg.wait_for_timeout(400)
    pg.click("[data-free]"); pg.wait_for_timeout(700)
    pg.click("[data-free]"); pg.wait_for_timeout(700)
    t = pg.evaluate("()=>document.querySelector('.cart__total strong')?.textContent.replace(/[^\\d]/g,'')")
    check(t == "600", f"同じ金額2回で¥600（実測¥{t}）")
    b.close()

    # ⑤ 無効な金額は弾く
    b, pg = fresh(p, ["abc"])
    pg.click("[data-free]"); pg.wait_for_timeout(700)
    t = pg.evaluate("()=>document.querySelector('.cart__total strong')?.textContent.replace(/[^\\d]/g,'')")
    check(t == "0", f"無効な金額は登録されない（実測¥{t}）")
    b.close()

    # ⑥ 桁の打ち間違い（¥350 のつもりで ¥35000）は確認が出る
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 1080, "height": 620}).new_page()
    def dismiss_confirm(d):
        if d.type == "prompt":
            d.accept("35000")
        else:
            d.dismiss()           # confirm を「キャンセル」＝打ち間違いだった場合
    pg.on("dialog", dismiss_confirm)
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(1100)
    pg.click("text=マルシェ"); pg.wait_for_timeout(700)
    pg.click("[data-free]"); pg.wait_for_timeout(900)
    t = pg.evaluate("()=>document.querySelector('.cart__total strong')?.textContent.replace(/[^\\d]/g,'')")
    check(t == "0", f"¥10,000以上は確認が出て、キャンセルすれば登録されない（実測¥{t}）")
    b.close()

    # ⑦ 会計まで通す／商品マスタを汚さない
    b, pg = fresh(p, ["350", "手作りポーチ"])
    pg.click(".cattabs button[data-cat='こもれび']"); pg.wait_for_timeout(400)
    pg.click(".pbtn:has-text('バッヂ 250円')"); pg.wait_for_timeout(250)
    pg.click("[data-free]"); pg.wait_for_timeout(800)
    pg.click("button:has-text('¥1,000')"); pg.wait_for_timeout(300)
    pg.click("[data-done]"); pg.wait_for_timeout(1200)
    sale = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').getAll();
      q.onsuccess=()=>res(q.result[0]);};})""")
    check(sale["total"] == 600, f"保存された合計¥{sale['total']}（期待600）")
    free = [i for i in sale["items"] if i["name"] == "手作りポーチ"][0]
    check(free["unit_price"] == 350 and free["category"] == "こもれび", f"その他がカテゴリー付きで保存: {free['name']} ¥{free['unit_price']} {free['category']}")
    n = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const q=r.result.transaction('products').objectStore('products').getAll();
      q.onsuccess=()=>res(q.result.filter(x=>x.terminal==='marche').length);};})""")
    check(n == 39, f"商品マスタは39品のまま＝その他は商品登録されない（実測{n}）")
    b.close()

    # ⑧ 「すべて」タブは出店者（分類）を聞く。
    #    マルシェの分類＝売上の帰属先なので、空のまま登録すると精算で揉める（ネイト指摘）
    b, pg = fresh(p, ["350", "3", ""])      # 3 = こもれび
    pg.click("[data-free]"); pg.wait_for_timeout(1000)
    it = pg.evaluate("()=>[...document.querySelectorAll('.cart__list *')].map(e=>e.textContent.trim()).join(' ')")
    check("こもれび その他" in it, "「すべて」タブでは分類を選んでから登録される")
    b.close()

    # ⑨ 分類選択でキャンセル＝何も追加しない
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 1080, "height": 620}).new_page()
    n = [0]
    def cancel_category(d):
        n[0] += 1
        if n[0] == 1:
            d.accept("350")
        else:
            d.dismiss()
    pg.on("dialog", cancel_category)
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(1100)
    pg.click("text=マルシェ"); pg.wait_for_timeout(700)
    pg.click("[data-free]"); pg.wait_for_timeout(900)
    t = pg.evaluate("()=>document.querySelector('.cart__total strong')?.textContent.replace(/[^\\d]/g,'')")
    check(t == "0", f"分類選択でキャンセル＝追加されない（実測¥{t}）")
    b.close()

    # ⑩ 商品名でキャンセル＝何も追加しない（金額の打ち間違いに気づいた時の取り消し）
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 1080, "height": 620}).new_page()
    m = [0]
    def cancel_name(d):
        m[0] += 1
        d.accept("350") if m[0] == 1 else d.dismiss()
    pg.on("dialog", cancel_name)
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(1100)
    pg.click("text=マルシェ"); pg.wait_for_timeout(700)
    pg.click(".cattabs button[data-cat='ベーカリー']"); pg.wait_for_timeout(400)
    pg.click("[data-free]"); pg.wait_for_timeout(900)
    t = pg.evaluate("()=>document.querySelector('.cart__total strong')?.textContent.replace(/[^\\d]/g,'')")
    check(t == "0", f"商品名でキャンセル＝追加されない（実測¥{t}）")
    b.close()

print("\n==== 想定どおり ====" if ok else "\n==== 想定と違う ====")
raise SystemExit(0 if ok else 1)
