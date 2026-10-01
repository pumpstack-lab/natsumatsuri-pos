"""2026-09-16 実価格反映＋フード¥50ボタン の描画検証。
python3 scripts/verify_prices_cash50.py  (ローカルで python3 -m http.server 8087 を起動しておく)
"""
import json, sys
from playwright.sync_api import sync_playwright

def marche_seed_count():
    """src/core/products.js のマルシェ品数を数える（直書きの件数が陳腐化するのを防ぐ）。"""
    import pathlib, re as _re
    src = pathlib.Path(__file__).resolve().parent.parent / "src" / "core" / "products.js"
    body = src.read_text(encoding="utf-8")
    return len(_re.findall(r"terminal: 'marche'", body))


URL = "http://localhost:8087/index.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
OLD = [  # 旧仮価格をIndexedDBに先に入れて「テスト運用済みiPad」を再現
  {"id":"f1","terminal":"food","name":"冷やしパイン","price":300,"sort_order":0,"is_available":True},
  {"id":"f2","terminal":"food","name":"焼きそば","price":500,"sort_order":1,"is_available":False},
  {"id":"d3","terminal":"drink","name":"レモンサワー","price":400,"sort_order":2,"is_available":True},
  {"id":"u1","terminal":"drink","name":"追加した水","price":100,"sort_order":10,"is_available":True},
]
ok = True
def check(cond, msg):
    global ok
    print(("OK  " if cond else "NG  ") + msg); ok = ok and cond

with sync_playwright() as p:
    b = p.chromium.launch()
    for (w,h) in [(1080,620),(1024,535)]:
        ctx = b.new_context(viewport={"width":w,"height":h})
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        pg.goto(URL); pg.wait_for_timeout(500)
        # 旧データ投入 → リロードでマージ経路を通す
        pg.evaluate("""(old)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');r.onsuccess=()=>{const db=r.result;const names=[...db.objectStoreNames];const tx=db.transaction(names,'readwrite');const ps=tx.objectStore('products');ps.clear();old.forEach(o=>ps.put(o));if(names.includes('meta')){tx.objectStore('meta').delete('products_seed')}tx.oncomplete=()=>res(names)}})""", OLD)
        pg.reload(); pg.wait_for_timeout(600)
        prods = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');r.onsuccess=()=>{const q=r.result.transaction('products').objectStore('products').getAll();q.onsuccess=()=>res(q.result)}})""")
        by = {x["id"]:x for x in prods}
        # 件数は seed の実数から導く。オーナーから価格が届くたびにマルシェの品数は変わるので、
        # 数字を直書きすると毎回この検証が嘘で落ちる（2026-10-01 実際に落ちた）。
        n_marche = marche_seed_count()
        fest = [x for x in prods if x["terminal"] in ("food", "drink")]
        check(len(fest)==16, f"[{w}x{h}] 祭りの商品16(15+ユーザー追加1)={len(fest)}")
        check(len(prods)==n_marche+16, f"[{w}x{h}] 全商品{n_marche+16}(祭り16+マルシェ{n_marche})={len(prods)}")
        check(by.get("f2",{}).get("name")=="広島焼き" and by["f2"]["price"]==600 and by["f2"]["is_available"]==False, "f2 広島焼き¥600・売り切れ状態は維持")
        check(by.get("f5",{}).get("price")==1000 and by.get("d10",{}).get("price")==250 and by.get("d3",{}).get("price")==500, "f5=1000 d10=250 d3=500")
        check("u1" in by, "ユーザー追加商品が残る")
        for term in ["food","drink"]:
            pg.click(f"[data-pick={term}]"); pg.wait_for_timeout(300)
            units = pg.evaluate("()=>[...document.querySelectorAll('[data-cash]')].map(b=>b.dataset.cash)")
            exp = ["50","100","500","1000","5000"] if term=="food" else ["50","100","1000","5000"]
            check(units==exp, f"[{w}x{h}] {term} 金種ボタン={units}")
            m = pg.evaluate("""()=>{const d=document.querySelector('[data-done]').getBoundingClientRect();const c=document.querySelector('.cashcol').getBoundingClientRect();const rows=document.querySelectorAll('.cashcol__row').length;const btns=[...document.querySelectorAll('.cashcol__row button')].map(b=>({t:b.textContent.trim(),w:Math.round(b.getBoundingClientRect().width),h:Math.round(b.getBoundingClientRect().height)}));return {doneBottom:d.bottom,doneH:d.height,vh:innerHeight,rows,btns,names:[...document.querySelectorAll('.pbtn[data-add]')].map(x=>x.textContent.replace(/\\s+/g,' ').trim())}}""")
            check(m["doneBottom"] <= m["vh"]+0.5 and m["doneH"]>0, f"[{w}x{h}] {term} 支払い完了 bottom={m['doneBottom']:.0f} <= vh={m['vh']}")
            check(m["rows"]==4, f"[{w}x{h}] {term} 金種エリア行数={m['rows']}")
            minw = min(x["w"] for x in m["btns"] if x["t"] and "商品券" not in x["t"])
            check(minw>=60, f"[{w}x{h}] {term} ボタン最小幅={minw}px  {m['btns']}")
            print("    商品:", m["names"])
            pg.screenshot(path=f"{OUT}/reg_{term}_{w}x{h}.png")
            pg.click("[data-go=top]"); pg.wait_for_timeout(200)
        # 修正シート（フード）: 1件登録して履歴から開く
        pg.click("[data-pick=food]"); pg.wait_for_timeout(300)
        pg.click("[data-add]"); pg.click("[data-done]"); pg.wait_for_timeout(300)
        pg.click("[data-go2]"); pg.wait_for_timeout(300)
        pg.click("[data-edit]"); pg.wait_for_timeout(300)
        eu = pg.evaluate("()=>[...document.querySelectorAll('[data-ecash]')].map(b=>b.dataset.ecash)")
        check(eu==["50","100","500","1000","5000"], f"[{w}x{h}] 修正シート food 金種={eu}")
        pg.screenshot(path=f"{OUT}/edit_food_{w}x{h}.png")
        ctx.close()
    b.close()
print("ALL OK" if ok else "SOME NG"); sys.exit(0 if ok else 1)
