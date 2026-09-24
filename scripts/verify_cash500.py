"""2026-09-24 「金額のボタンが押せない」の修正検証。
実ブラウザで各金種ボタンを実際にクリックし、預かり金が増えるか・
ボタンが押した表示（is-on / ×N）になるかを数値で測る。

前提: ローカルで python3 -m http.server 8087 を起動しておく
実行:  python3 scripts/verify_cash500.py

⚠️ 検証用に会計を1件登録する。後片付けはこのスクリプトが作った会計のIDだけを
   指定して消す（sales全体の clear() は絶対に使わない）。
   実売上の入った端末・ブラウザでは実行しないこと。
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8087/index.html"
ok = True
def check(cond, msg):
    global ok
    print(("OK  " if cond else "NG  ") + msg); ok = ok and cond

EXPECT = {"food": [50, 100, 500, 1000, 5000], "drink": [50, 100, 1000, 5000]}

with sync_playwright() as p:
    b = p.chromium.launch()
    for (w, h) in [(1080, 620), (1024, 535)]:
        ctx = b.new_context(viewport={"width": w, "height": h})
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        pg.goto(URL); pg.wait_for_timeout(600)

        for term, units in EXPECT.items():
            pg.click(f"[data-pick={term}]"); pg.wait_for_timeout(300)
            shown = pg.evaluate("()=>[...document.querySelectorAll('[data-cash]')].map(b=>Number(b.dataset.cash))")
            check(shown == units, f"[{w}x{h}] {term} 表示金種={shown}")

            # 金種ボタンを1つずつ押して、預かりが額面どおり増えるか実測
            running = 0
            for u in units:
                pg.click(f"[data-cash='{u}']"); pg.wait_for_timeout(120)
                running += u
                got = pg.evaluate("""()=>{const e=document.querySelector('.pay__recv strong');
                  return e? Number(e.textContent.replace(/[^0-9]/g,'')||0) : -1}""")
                st = pg.evaluate(f"""()=>{{const b=document.querySelector("[data-cash='{u}']");
                  return {{on:b.classList.contains('is-on'), txt:b.textContent.replace(/\\s+/g,' ').trim(),
                           disabled:b.disabled, pe:getComputedStyle(b).pointerEvents}}}}""")
                check(got == running, f"[{w}x{h}] {term} ¥{u}を押す→預かり ¥{got}（期待 ¥{running}）")
                check(st["on"], f"[{w}x{h}] {term} ¥{u} 押した表示(is-on)={st['on']} txt={st['txt']!r}")
                check("×1" in st["txt"], f"[{w}x{h}] {term} ¥{u} 回数×1の表示={st['txt']!r}")
                check(not st["disabled"] and st["pe"] != "none", f"[{w}x{h}] {term} ¥{u} クリック可 disabled={st['disabled']} pointer-events={st['pe']}")

            # 同じ金種の連打が積み上がるか（フードの¥500で実害が出た枠）
            u = units[-3] if len(units) >= 3 else units[0]
            before = pg.evaluate("()=>Number(document.querySelector('.pay__recv strong').textContent.replace(/[^0-9]/g,''))")
            pg.click(f"[data-cash='{u}']"); pg.wait_for_timeout(120)
            after = pg.evaluate("()=>Number(document.querySelector('.pay__recv strong').textContent.replace(/[^0-9]/g,''))")
            txt = pg.evaluate(f"""()=>document.querySelector("[data-cash='{u}']").textContent.replace(/\\s+/g,' ').trim()""")
            check(after == before + u, f"[{w}x{h}] {term} ¥{u} 2回目 ¥{before}→¥{after}")
            check("×2" in txt, f"[{w}x{h}] {term} ¥{u} 回数×2の表示={txt!r}")

            pg.click("[data-clear]"); pg.wait_for_timeout(150)
            cleared = pg.evaluate("()=>document.querySelector('.pay__recv strong').textContent.trim()")
            check(cleared == "—", f"[{w}x{h}] {term} クリアで預かりが—に戻る={cleared!r}")
            pg.click("[data-go='top']"); pg.wait_for_timeout(200)

        # フード¥500で会計を1件通し、保存された預かり金が¥500として残るか
        pg.click("[data-pick=food]"); pg.wait_for_timeout(300)
        pg.click(".pbtn"); pg.wait_for_timeout(120)      # 先頭商品（冷やしパイン¥300）
        pg.click("[data-cash='500']"); pg.wait_for_timeout(120)
        done = pg.evaluate("()=>{const b=document.querySelector('[data-done]');return {disabled:b.disabled,txt:b.textContent.trim()}}")
        check(not done["disabled"], f"[{w}x{h}] ¥300の商品に¥500預かり→支払い完了が押せる disabled={done['disabled']}")
        chg = pg.evaluate("()=>document.querySelector('.pay__change strong').textContent.trim()")
        check(chg == "¥200", f"[{w}x{h}] お釣り表示={chg!r}（期待 ¥200）")
        pg.click("[data-done]"); pg.wait_for_timeout(500)
        saved = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').getAll();
          q.onsuccess=()=>res(q.result.map(s=>({received:s.received,total:s.total,status:s.status})))}})""")
        latest = [s for s in saved if s["status"] == "active"]
        check(any(s["received"] == 500 and s["total"] == 300 for s in latest),
              f"[{w}x{h}] 保存された会計に預かり¥500が残る → {latest[:3]}")

        # 後片付け: このスクリプトが今作った会計のIDだけを消す。
        # sales 全体の clear() は実売上を巻き込むため絶対に使わない
        # （feedback_prod_e2e_no_destructive_cleanup の教訓）。
        made = [s["id"] for s in pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').getAll();
          q.onsuccess=()=>res(q.result)}})""") if s.get("received") == 500 and s.get("total") == 300]
        check(len(made) >= 1, f"[{w}x{h}] 後片付け対象（このスクリプトが作った会計）={len(made)}件")
        pg.evaluate("""(ids)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const tx=r.result.transaction('sales','readwrite');const st=tx.objectStore('sales');
          ids.forEach(id=>st.delete(id));tx.oncomplete=()=>res(1)}})""", made)
        left = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').count();
          q.onsuccess=()=>res(q.result)}})""")
        check(left == 0, f"[{w}x{h}] 後片付け後の残件数={left}")
        ctx.close()
    b.close()

print("\n==== " + ("ALL OK" if ok else "FAILED") + " ====")
sys.exit(0 if ok else 1)
