"""ベーカリー4品の価格確定（2026-10-01 オーナー受領）を旧データ入りの端末で実測する。

旧版（ベーカリーが暫定¥100）を使った端末から seed を上げた時に、
新価格が届き、品切れにしていた商品は勝手に復活しないことを見る。
前提: python3 -m http.server 8087
"""
from playwright.sync_api import sync_playwright
OLD=[  # 旧版を使った端末（ベーカリーは¥100のまま・1品は品切れにしてある）
 {"id":"m23","terminal":"marche","name":"とんだバナナ１本","price":100,"category":"ベーカリー","sort_order":31,"is_available":True},
 {"id":"m24","terminal":"marche","name":"とんだバナナカット","price":100,"category":"ベーカリー","sort_order":32,"is_available":False},
 {"id":"m25","terminal":"marche","name":"トマト&バジルのプリッツ","price":100,"category":"ベーカリー","sort_order":33,"is_available":True},
]
ok=True
def check(c,m):
    global ok; print(("OK  " if c else "NG  ")+m); ok=ok and c
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":1080,"height":620}).new_page()
    pg.on("dialog",lambda d:d.accept())
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(1000)
    pg.evaluate("""(old)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const db=r.result;const tx=db.transaction(['products','meta'],'readwrite');
      const ps=tx.objectStore('products');ps.clear();old.forEach(o=>ps.put(o));
      tx.objectStore('meta').put({key:'products_seed',value:'2026-10-01-komorebi'});
      tx.oncomplete=()=>res(1);};})""",OLD)
    pg.reload(); pg.wait_for_timeout(1300)
    rows=pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const q=r.result.transaction('products').objectStore('products').getAll();
      q.onsuccess=()=>res(q.result);};})""")
    by={r["id"]:r for r in rows}
    for pid,nm,pr in [("m23","とんだバナナ１本 1,500円",1500),("m24","とんだバナナカット 330円",330),
                      ("m25","トマト&バジルのプリッツ 480円",480),("m26","晩白柚とピスタチオのビスコッティ 480円",480)]:
        r=by.get(pid)
        check(bool(r) and r["name"]==nm and r["price"]==pr, f"{pid}: {r and r['name']} ¥{r and r['price']}")
    check(by["m24"]["is_available"]==False, "品切れにしていた商品の品切れ状態は保たれる（勝手に復活しない）")

    pg.click("text=マルシェ"); pg.wait_for_timeout(700)
    pg.click(".cattabs button[data-cat='ベーカリー']"); pg.wait_for_timeout(500)
    names=pg.eval_on_selector_all(".pbtn__name","e=>e.map(x=>x.textContent.trim())")
    print("  ベーカリータブ:",names)
    for w in ["とんだバナナ１本 1,500円","トマト&バジルのプリッツ 480円","晩白柚とピスタチオのビスコッティ 480円"]:
        check(w in names, f"画面に「{w}」が出る")
    check("とんだバナナカット 330円" not in names, "品切れの商品はレジに出ない（現場で復活させる運用）")
    dup=pg.evaluate("""()=>[...document.querySelectorAll('.pbtn')].filter(b=>{
        const n=b.querySelector('.pbtn__name'),pr=b.querySelector('.pbtn__price');
        return n&&pr&&/\\d\\s*円$/.test(n.textContent.trim());}).map(b=>b.querySelector('.pbtn__name').textContent.trim())""")
    check(dup==[], f"価格行の二重表示なし（違反={dup}）")
    # 実会計: 1,500 + 480 = 1,980
    for lb in ["とんだバナナ１本 1,500円","トマト&バジルのプリッツ 480円"]:
        pg.click(f".pbtn:has-text('{lb}')"); pg.wait_for_timeout(200)
    t=pg.evaluate("()=>document.querySelector('.cart__total strong')?.textContent.replace(/[^\\d]/g,'')")
    check(t=="1980", f"バナナ1本+プリッツ=¥1,980（実測=¥{t}）")
    b.close()
print("\n==== 想定どおり ====" if ok else "\n==== 想定と違う ====")
