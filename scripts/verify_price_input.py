"""現場で価格を入力した時に、金額が意図せず化けないかを実測する。

⚠️ この検証が存在する理由（2026-10-01 本番前の総当たり検証で発見）:
  parseInt("1,500") は **1** を返す。ボタンの表示が「1,500円」なので
  職員がカンマごと入力するのは自然な操作で、しかも警告が出ないまま
  ¥1,500 の商品が **¥1** で登録されていた。
  iPadの日本語キーボードでは全角数字「４８０」も入る（こちらはalertで弾かれ、
  現場で修正が進まなくなる）。
  → parsePriceInput() で全角・カンマ・通貨記号を正規化し、曖昧なものは弾く。

前提: python3 -m http.server 8087
"""
from playwright.sync_api import sync_playwright
ok=True
def check(c,m):
    global ok; print(("OK  " if c else "NG  ")+m); ok=ok and c
def case(p,val,expect_price,expect_name,label):
    ctx=p.chromium.launch(); pg=ctx.new_context(viewport={"width":1080,"height":620}).new_page()
    alerts=[]; seq=["トマト&バジルのプリッツ 480円","ベーカリー",val]
    def h(d):
        if d.type=="alert": alerts.append(d.message)
        d.accept(seq.pop(0) if seq and d.type=="prompt" else "")
    pg.on("dialog",h)
    pg.goto("http://localhost:8087/index.html"); pg.wait_for_timeout(1100)
    pg.click("text=マルシェ"); pg.wait_for_timeout(600)
    pg.click("[data-go=top]"); pg.wait_for_timeout(400)
    pg.click("[data-go=products]"); pg.wait_for_timeout(600)
    pg.click("[data-edit=m25]"); pg.wait_for_timeout(900)
    g=pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const q=r.result.transaction('products').objectStore('products').getAll();
      q.onsuccess=()=>res(q.result.find(x=>x.id==='m25'));};})""")
    print(f'  {label}: ¥{g["price"]} 「{g["name"]}」 alert={"あり" if alerts else "なし"}')
    check(g["price"]==expect_price and g["name"]==expect_name, f"{label} → ¥{expect_price}")
    ctx.close()
with sync_playwright() as p:
    case(p,"1,500",1500,"トマト&バジルのプリッツ 1,500円","カンマ付き「1,500」")
    case(p,"４８０",480,"トマト&バジルのプリッツ 480円","全角「４８０」")
    case(p,"２，６００",2600,"トマト&バジルのプリッツ 2,600円","全角カンマ付き")
    case(p,"650",650,"トマト&バジルのプリッツ 650円","半角「650」")
    case(p,"abc",480,"トマト&バジルのプリッツ 480円","無効入力は弾いて元のまま")
print("\n==== 想定どおり ====" if ok else "\n==== 想定と違う ====")
raise SystemExit(0 if ok else 1)
