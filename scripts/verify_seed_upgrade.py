"""既に旧版を使った端末に、新しい商品が正しく入るかを実測する。

⚠️ この検証が存在する理由（2026-10-01）:
  レスポの商品を入れ替えた際、旧商品のid（m01/m02）を新商品に流用した。
  mergeDefaultProducts は is_available（品切れ状態）を運用実績として保持するため、
  **旧商品を品切れにしていた端末では、新商品が最初から画面に出ない**状態になった。
  新規ブラウザでの検証では絶対に再現しない（まっさらなDBには旧状態が無いため）。
  → 新商品には新しいidを使い、廃止したidは RETIRED_PRODUCT_IDS で端末から消す。

前提: ローカルで python3 -m http.server 8087 を起動しておく
実行:  python3 scripts/verify_seed_upgrade.py
"""
from playwright.sync_api import sync_playwright
OLD = [
  {"id":"m01","terminal":"marche","name":"ハロウィンチャーム","price":100,"category":"レスポ","sort_order":0,"is_available":False},
  {"id":"m02","terminal":"marche","name":"ビーズブレスレット","price":100,"category":"レスポ","sort_order":1,"is_available":True},
  {"id":"m08","terminal":"marche","name":"ブローチ","price":100,"category":"こもあん","sort_order":7,"is_available":True},
  {"id":"u1","terminal":"marche","name":"現場で足した商品","price":300,"category":"レスポ","sort_order":99,"is_available":True},
]
ok=True
def check(c,m):
    global ok; print(("OK  " if c else "NG  ")+m); ok=ok and c
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1080,"height":620}); pg=ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(900)
    # 旧データを入れて「テスト運用済みiPad」を再現
    pg.evaluate("""(old)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const db=r.result;const tx=db.transaction(['products','meta'],'readwrite');
      const ps=tx.objectStore('products');ps.clear();old.forEach(o=>ps.put(o));
      tx.objectStore('meta').delete('products_seed');tx.oncomplete=()=>res(1)}})""", OLD)
    pg.reload(); pg.wait_for_timeout(1200)
    prods=pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const q=r.result.transaction('products').objectStore('products').getAll();q.onsuccess=()=>res(q.result)}})""")
    by={x["id"]:x for x in prods}
    check("m01" not in by and "m02" not in by, f"廃止した旧id(m01/m02)がDBから消えた")
    check(by["m37"]["name"]=="ブレスレット 200円" and by["m37"]["is_available"]==True,
          f"新商品は新idで入り売れる状態: {by['m37']['name']} 売れる={by['m37']['is_available']}")
    check(by["m08"]["name"]=="ブローチ 1,100円" and by["m08"]["price"]==1100, f"m08: {by['m08']['name']}")
    check("u1" in by and by["u1"]["name"]=="現場で足した商品", "現場で足した商品は残る")
    old_names=[x["name"] for x in prods if x["name"] in ("ハロウィンチャーム","ビーズブレスレット")]
    check(old_names==[], f"旧商品名は消えている（残={old_names}）")
    # 画面に何が出るか
    pg.click("[data-pick=marche]"); pg.wait_for_timeout(500)
    pg.click("[data-cat='レスポ']"); pg.wait_for_timeout(350)
    shown=pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent.trim())")
    print("  → レスポに出る商品:", shown)
    check("ブレスレット 200円" in shown, "新商品が画面に出る（品切れを引き継いでいない）")
    check(not any(n in shown for n in ["ハロウィンチャーム","ビーズブレスレット"]), "旧商品は画面に出ない")
    b.close()
print("\n==== "+("想定どおり" if ok else "要注意あり")+" ====")
