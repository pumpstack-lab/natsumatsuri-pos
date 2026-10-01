"""こもれびの価格確定（2026-10-01 オーナー受領）を旧データ入りの端末で実測する。

検証する事故シナリオ:
  1. 「無し」の3品（キーホルダー紙粘土/アクリルキーホルダー/編み物）が端末から消えるか。
     1つを品切れ状態にしておく＝実際のテスト運用済みiPadに近い状態を作る。
  2. 価格を¥100から直した4品が、新しい価格で表示・会計されるか。
  3. 新規のシュシュ4種が画面に出て、金額で見分けられるか。
  4. 名前に金額が入った商品は価格行を二重に出さないか。

前提: python3 -m http.server 8087
実行:  python3 scripts/verify_komorebi_prices.py
"""
from playwright.sync_api import sync_playwright

# 旧版を使った端末の状態（こもれび部分のみ・編み物は品切れにしてある）
OLD = [
  {"id":"m10","terminal":"marche","name":"キーホルダー（紙粘土）","price":100,"category":"こもれび","sort_order":14,"is_available":True},
  {"id":"m11","terminal":"marche","name":"アクリルキーホルダー","price":100,"category":"こもれび","sort_order":15,"is_available":True},
  {"id":"m12","terminal":"marche","name":"編み物","price":100,"category":"こもれび","sort_order":16,"is_available":False},
  {"id":"m13","terminal":"marche","name":"みかんちゃん大","price":100,"category":"こもれび","sort_order":17,"is_available":True},
  {"id":"m22","terminal":"marche","name":"カレンダー","price":100,"category":"こもれび","sort_order":29,"is_available":True},
]
ok = True
def check(c, m):
    global ok
    print(("OK  " if c else "NG  ") + m)
    ok = ok and c

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":1080,"height":620})
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(900)
    pg.evaluate("""(old)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const db=r.result;const tx=db.transaction(['products','meta'],'readwrite');
      const ps=tx.objectStore('products');ps.clear();old.forEach(o=>ps.put(o));
      tx.objectStore('meta').put({key:'products_seed',value:'2026-10-01-respo'});
      tx.oncomplete=()=>res(1);};})""", OLD)
    pg.reload(); pg.wait_for_timeout(1200)

    rows = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const db=r.result;const g=db.transaction('products').objectStore('products').getAll();
      g.onsuccess=()=>res(g.result);};})""")
    by_id = {r["id"]: r for r in rows}

    # 1) 出品に無い3品が端末から消える（品切れにしていたm12も含む）
    for pid, nm in [("m10","キーホルダー（紙粘土）"),("m11","アクリルキーホルダー"),("m12","編み物")]:
        check(pid not in by_id, f"出品に無い {nm}({pid}) がDBから消えた")

    # 2) 価格を直した4品
    for pid, nm, price in [("m13","みかんちゃん大 1,350円",1350),("m14","みかんちゃん小 500円",500),
                          ("m17","ちゅるちゅるみかん 500円",500),("m22","カレンダー 2,600円",2600)]:
        r = by_id.get(pid)
        check(bool(r) and r["name"]==nm and r["price"]==price,
              f"{pid}: {r and r['name']} ¥{r and r['price']} （期待 {nm} ¥{price}）")

    # 3) 新規シュシュ4種が入り、売れる状態
    for pid, price in [("m39",450),("m40",400),("m41",350),("m42",300)]:
        r = by_id.get(pid)
        check(bool(r) and r["price"]==price and r["is_available"],
              f"{pid}: シュシュ ¥{r and r['price']} 売れる={r and r['is_available']}")

    # 4) 画面に出る「こもれび」の中身
    # ⚠️ 起動直後はイベント選択画面。マルシェを選ばないと商品が1つも出ない
    #    （2026-10-01 これを忘れて「画面に出ない」と誤判定した）
    pg.click("text=マルシェ"); pg.wait_for_timeout(700)
    tabs = pg.eval_on_selector_all(".cattabs button", "e=>e.map(x=>x.textContent.trim())")
    check("こもれび" in tabs, f"カテゴリータブに「こもれび」がある（実測={tabs}）")
    pg.click(".cattabs button[data-cat='こもれび']"); pg.wait_for_timeout(500)
    names = pg.eval_on_selector_all(".pbtn__name", "els=>els.map(e=>e.textContent.trim())")
    for gone in ["キーホルダー（紙粘土）","アクリルキーホルダー","編み物"]:
        check(gone not in names, f"画面に「{gone}」が出ない")
    for want in ["シュシュ 450円","シュシュ 300円","みかんちゃん大 1,350円","カレンダー 2,600円"]:
        check(want in names, f"画面に「{want}」が出る")

    # 5) 名前に金額が入った商品は価格行を二重に出さない
    dup = pg.evaluate("""()=>[...document.querySelectorAll('.pbtn')].filter(b=>{
        const n=b.querySelector('.pbtn__name'), pr=b.querySelector('.pbtn__price');
        return n && pr && /\\d\\s*円$/.test(n.textContent.trim());
      }).map(b=>b.querySelector('.pbtn__name').textContent.trim())""")
    check(dup == [], f"金額入りの商品が価格行を二重に出していない（違反={dup}）")

    # 6) 実際に会計して金額が合うか（カレンダー2,600 + シュシュ450 = 3,050）
    for label in ["カレンダー 2,600円","シュシュ 450円"]:
        el = pg.query_selector(f".pbtn:has-text('{label}')")
        if el: el.click(); pg.wait_for_timeout(200)
    total = pg.evaluate("""()=>{const e=document.querySelector('.cart__total strong');
        return e?e.textContent.replace(/[^\\d]/g,''):''}""")
    check(total == "3050", f"カレンダー+シュシュの合計が¥3,050（実測=¥{total or '取得できず'}）")

    b.close()

print("\n==== 想定どおり ====" if ok else "\n==== 想定と違う ====")
raise SystemExit(0 if ok else 1)
