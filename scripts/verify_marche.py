"""2026-09-25 マルシェ対応（イベント切替＋カテゴリータブ）の検証。

前提: ローカルで python3 -m http.server 8087 を起動しておく
実行:  python3 scripts/verify_marche.py

⚠️ 検証用の会計を作る。後片付けは作った会計のIDだけを消す。
   実売上の入った端末・ブラウザでは実行しないこと。
"""
import sys, zipfile, re, pathlib, tempfile
from playwright.sync_api import sync_playwright

URL = "http://localhost:8087/index.html"
ok = True
def check(cond, msg):
    global ok
    print(("OK  " if cond else "NG  ") + msg); ok = ok and cond

def read_sheets(path):
    z = zipfile.ZipFile(path)
    names = re.findall(r'<sheet name="([^"]+)"', z.read("xl/workbook.xml").decode())
    out = {}
    for i, nm in enumerate(names, start=1):
        xml = z.read(f"xl/worksheets/sheet{i}.xml").decode()
        rows = []
        for rm in re.finditer(r"<row[^>]*>(.*?)</row>", xml, re.S):
            cells = []
            for cm in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*)>(.*?)</c>', rm.group(1), re.S):
                ref, attrs, body = cm.groups()
                col = 0
                for ch in ref: col = col * 26 + (ord(ch) - 64)
                while len(cells) < col - 1: cells.append("")
                if 'inlineStr' in attrs:
                    t = re.search(r"<t[^>]*>(.*?)</t>", body, re.S)
                    cells.append(t.group(1) if t else "")
                else:
                    v = re.search(r"<v>(.*?)</v>", body, re.S)
                    cells.append(v.group(1) if v else "")
            rows.append(cells)
        out[nm] = rows
    return out

EXPECT_CATS = ["すべて", "レスポ", "こもあん", "こもれび", "ベーカリー", "B型"]

with sync_playwright() as p:
    b = p.chromium.launch()
    for (w, h) in [(1080, 620), (1024, 535)]:
        ctx = b.new_context(viewport={"width": w, "height": h}, accept_downloads=True)
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(900)

        # --- トップがイベント選択になっている ---
        h1 = pg.evaluate("()=>document.querySelector('.top__lead h1').textContent.trim()")
        check(h1 == "どのイベントですか？", f"[{w}x{h}] トップの見出し={h1!r}")
        picks = pg.evaluate("()=>[...document.querySelectorAll('[data-pick]')].map(b=>b.dataset.pick)")
        check(picks == ["marche", "food", "drink"], f"[{w}x{h}] イベント={picks}")

        # --- マルシェ: カテゴリータブ ---
        pg.click("[data-pick=marche]"); pg.wait_for_timeout(600)

        # イベント名が画面に正しく出るか（marcheで「ドリンク」と出る不具合があった）
        bar = pg.evaluate("()=>document.querySelector('.bar__title').textContent.trim()")
        check(bar == "🛍 マルシェ", f"[{w}x{h}] レジ画面の見出し={bar!r}")

        tabs = pg.evaluate("()=>[...document.querySelectorAll('[data-cat]')].map(b=>b.textContent.trim())")
        check(tabs == EXPECT_CATS, f"[{w}x{h}] タブ={tabs}")
        n_all = pg.evaluate("()=>document.querySelectorAll('.pbtn').length")
        check(n_all == 31, f"[{w}x{h}] 「すべて」の商品数={n_all}（期待31）")

        # カテゴリーを選ぶと商品が入れ替わる
        pg.click("[data-cat='こもあん']"); pg.wait_for_timeout(300)
        names = pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent.trim())")
        check(len(names) == 7, f"[{w}x{h}] こもあんの商品数={len(names)} {names}")
        check("ブローチ" in names and "ハロウィンチャーム" not in names,
              f"[{w}x{h}] こもあんの中身が正しい={names}")
        on = pg.evaluate("()=>[...document.querySelectorAll('[data-cat].is-on')].map(b=>b.textContent.trim())")
        check(on == ["こもあん"], f"[{w}x{h}] 選択中のタブ={on}")

        # 一味シリーズは3種に分かれている（2026-09-28 オーナー確定）
        pg.click("[data-cat='こもれび']"); pg.wait_for_timeout(300)
        knames = pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent.trim())")
        for n in ["一味KAN", "すだちの一撃", "ひ〜の用心", "ケチャップ"]:
            check(n in knames, f"[{w}x{h}] こもれびに『{n}』がある")
        prices = pg.evaluate("""()=>Object.fromEntries([...document.querySelectorAll('.pbtn')]
          .map(b=>[b.querySelector('.pbtn__name').textContent.trim(),
                   b.querySelector('.pbtn__price').textContent.trim()]))""")
        check(prices.get("すだち×はちみつシロップ") == "¥800", f"[{w}x{h}] 価格表示 すだち×はちみつシロップ={prices.get('すだち×はちみつシロップ')}")
        check(prices.get("おい！ポン酢") == "¥720", f"[{w}x{h}] 価格表示 おい！ポン酢={prices.get('おい！ポン酢')}")

        pg.click("[data-cat='B型']"); pg.wait_for_timeout(300)
        names = pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent.trim())")
        check(sorted(names) == sorted(["魚魚", "こもだれ"]), f"[{w}x{h}] B型の商品={names}")

        # --- 会計を通す → 先頭タブに戻る ---
        pg.click(".pbtn"); pg.wait_for_timeout(150)
        # 商品の価格に足りる預かりを入れる（価格が上がっても足りるよう¥1,000）
        pg.click("[data-cash='1000']"); pg.wait_for_timeout(150)
        done = pg.evaluate("()=>document.querySelector('[data-done]').disabled")
        check(not done, f"[{w}x{h}] 支払い完了が押せる")
        pg.click("[data-done]"); pg.wait_for_timeout(700)
        on = pg.evaluate("()=>[...document.querySelectorAll('[data-cat].is-on')].map(b=>b.textContent.trim())")
        check(on == ["すべて"], f"[{w}x{h}] 会計後は先頭タブに戻る={on}")

        # --- 祭りに切り替えるとタブが出ない・データが無傷 ---
        pg.click("[data-go='top']"); pg.wait_for_timeout(300)
        pg.click("[data-pick=food]"); pg.wait_for_timeout(700)

        bar = pg.evaluate("()=>document.querySelector('.bar__title').textContent.trim()")
        check(bar == "🍔 フード（夏祭り）", f"[{w}x{h}] 祭りのレジ画面の見出し={bar!r}")

        check(pg.evaluate("()=>document.querySelectorAll('[data-cat]').length") == 0,
              f"[{w}x{h}] 祭りではカテゴリータブが出ない")
        fnames = pg.evaluate("()=>[...document.querySelectorAll('.pbtn__name')].map(x=>x.textContent.trim())")
        check("広島焼き" in fnames and len(fnames) == 5, f"[{w}x{h}] 祭りのフード5品が無傷={fnames}")
        funits = pg.evaluate("()=>[...document.querySelectorAll('[data-cash]')].map(b=>Number(b.dataset.cash))")
        check(funits == [50, 100, 500, 1000, 5000], f"[{w}x{h}] 祭りの金種が無傷={funits}")

        # --- マルシェに戻ると売上が残っている ---
        pg.click("[data-go='top']"); pg.wait_for_timeout(300)
        meta = pg.evaluate("""()=>[...document.querySelectorAll('[data-pick]')].map(b=>
          ({id:b.dataset.pick, meta:b.querySelector('.pick__meta').textContent.trim()}))""")
        marche_meta = [m["meta"] for m in meta if m["id"] == "marche"][0]
        check("1組" in marche_meta, f"[{w}x{h}] トップにマルシェの売上が出る={marche_meta!r}")

        # --- Excel: カテゴリー列 ---
        pg.click("[data-pick=marche]"); pg.wait_for_timeout(500)
        pg.click("[data-go='top']"); pg.wait_for_timeout(300)
        pg.click("[data-go='export']"); pg.wait_for_timeout(600)
        with pg.expect_download() as dl:
            pg.click("[data-xlsx]")
        path = pathlib.Path(tempfile.gettempdir()) / "verify_marche.xlsx"
        dl.value.save_as(str(path))
        sheets = read_sheets(path)
        prod = sheets["商品別"]
        check(prod[0] == ["カテゴリー", "商品名", "単価", "個数", "売上", "構成比(%)"],
              f"[{w}x{h}] 商品別の見出し={prod[0]}")
        check(prod[1][0] == "B型", f"[{w}x{h}] カテゴリー列に値が入る={prod[1]}")

        check(errs == [], f"[{w}x{h}] JSエラー={errs}")

        # --- 後片付け: 作った会計のIDだけ消す ---
        ids = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').getAll();
          q.onsuccess=()=>res(q.result.map(s=>s.id))}})""")
        pg.evaluate("""(ids)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const tx=r.result.transaction('sales','readwrite');const st=tx.objectStore('sales');
          ids.forEach(i=>st.delete(i));tx.oncomplete=()=>res(1)}})""", ids)
        left = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
          r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').count();q.onsuccess=()=>res(q.result)}})""")
        check(left == 0, f"[{w}x{h}] 後片付け後の残件数={left}")
        ctx.close()
    b.close()

print("\n==== " + ("ALL OK" if ok else "FAILED") + " ====")
sys.exit(0 if ok else 1)
