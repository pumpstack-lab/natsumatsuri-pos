"""現場で価格を直した時に、名前の中の金額が嘘にならないかを実測する。

⚠️ この検証が存在する理由（2026-10-01 ネイト指摘）:
  「シュシュ 450円」のように名前に金額を入れる方式にしたため、
  職員が「商品の設定」で**価格だけ**直すとボタンは古い金額を表示し続ける。
  末尾が「円」の商品は価格行を出さない仕様（showsPriceLine）なので、
  画面のどこにも新しい価格が出ず、表示と請求額が食い違う。
  → 名前を触っていない時だけ、名前の中の金額も新価格に合わせる。

前提: python3 -m http.server 8087
実行:  python3 scripts/verify_price_edit_name_sync.py
"""
from playwright.sync_api import sync_playwright
ok=True
def check(c,m):
    global ok; print(("OK  " if c else "NG  ")+m); ok=ok and c

def run_case(p, pid, answers, label):
    """1ケースごとに新しいページを使う（dialogハンドラの取り合いを避ける）"""
    b=p.chromium.launch(); pg=b.new_context(viewport={"width":1080,"height":620}).new_page()
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(1100)
    pg.click("text=マルシェ"); pg.wait_for_timeout(600)
    pg.click("[data-go=top]"); pg.wait_for_timeout(400)
    pg.click("[data-go=products]"); pg.wait_for_timeout(600)
    seq=list(answers)
    pg.on("dialog", lambda d: d.accept(seq.pop(0) if seq else ""))
    pg.click(f"[data-edit={pid}]"); pg.wait_for_timeout(1000)
    got=pg.evaluate("""(id)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const q=r.result.transaction('products').objectStore('products').getAll();
      q.onsuccess=()=>res(q.result.find(x=>x.id===id));};})""", pid)
    print(f"  {label}: {pid} → 「{got['name']}」 ¥{got['price']}")
    b.close()
    return got

with sync_playwright() as p:
    # ケース1: 価格だけ直す → 名前の金額が追従する（これが今回の修正の本体）
    g=run_case(p,"m39",["シュシュ 450円","こもれび","480"],"価格だけ変更")
    check(g["price"]==480 and g["name"]=="シュシュ 480円", "価格だけ直すと名前の金額も追従する")

    # ケース2: 名前も自分で変えた → 入力した名前が勝つ（勝手に書き換えない）
    g=run_case(p,"m40",["シュシュ 特価","こもれび","300"],"名前も変更")
    check(g["name"]=="シュシュ 特価" and g["price"]==300, "職員が入れた名前が優先される")

    # ケース3: 名前に金額が入っていない商品 → 名前は触らない
    g=run_case(p,"m16",["ススメご飯","こもれび","750"],"金額なしの名前")
    check(g["name"]=="ススメご飯" and g["price"]==750, "金額なしの名前は変えない")

    # ケース4: 価格を変えない → 名前もそのまま
    g=run_case(p,"m42",["シュシュ 300円","こもれび","300"],"価格そのまま")
    check(g["name"]=="シュシュ 300円" and g["price"]==300, "価格を変えなければ名前もそのまま")

print("\n==== 想定どおり ====" if ok else "\n==== 想定と違う ====")
raise SystemExit(0 if ok else 1)
