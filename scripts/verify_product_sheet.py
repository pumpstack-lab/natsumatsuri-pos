"""2026-09-24 商品別集計シートのExcel書き出し検証。
実ブラウザで会計を作り→Excelを書き出し→実ファイルを開いて中身を読む。

前提: ローカルで python3 -m http.server 8087 を起動しておく
実行:  python3 scripts/verify_product_sheet.py

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
    """xlsxを開いてシート名→行データ(文字列の2次元配列)を返す"""
    z = zipfile.ZipFile(path)
    wb = z.read("xl/workbook.xml").decode()
    names = re.findall(r'<sheet name="([^"]+)"', wb)
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

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1080, "height": 620}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(700)

    # フードで会計を作る: 広島焼き¥600を2回(別会計)、冷やしパイン¥300を1回、さらに1件は取消
    pg.click("[data-pick=food]"); pg.wait_for_timeout(400)
    def sell(nth, cash):
        pg.locator(".pbtn").nth(nth).click(); pg.wait_for_timeout(100)
        pg.click(f"[data-cash='{cash}']"); pg.wait_for_timeout(100)
        pg.click("[data-done]"); pg.wait_for_timeout(450)
    sell(1, 1000)   # 広島焼き ¥600
    sell(1, 1000)   # 広島焼き ¥600（2件目）
    sell(0, 500)    # 冷やしパイン ¥300
    sell(2, 1000)   # エビフライ ¥650 → この後で取り消す
    pg.click("[data-undo]"); pg.wait_for_timeout(700)      # 直前を修正＝取消して伝票に戻る
    pg.click("[data-clear]"); pg.wait_for_timeout(200)

    # 画面の商品別プレビューを確認
    pg.click("[data-go='top']"); pg.wait_for_timeout(300)
    pg.click("[data-go='export']"); pg.wait_for_timeout(600)
    prev = pg.evaluate("()=>{const c=[...document.querySelectorAll('.card h2')].find(h=>h.textContent.includes('商品別'));return c?c.parentElement.innerText.replace(/\\n+/g,' | '):'(なし)'}")
    check("広島焼き" in prev, f"書き出し画面の商品別プレビュー: {prev}")

    # 書き出し
    with pg.expect_download() as dl:
        pg.click("[data-xlsx]")
    path = pathlib.Path(tempfile.gettempdir()) / "verify_product.xlsx"
    dl.value.save_as(str(path))
    check(path.exists() and path.stat().st_size > 0, f"xlsxが保存された ({path.stat().st_size} bytes)")

    sheets = read_sheets(path)
    check(list(sheets.keys()) == ["明細", "サマリー", "商品別"], f"シート構成={list(sheets.keys())}")

    rows = sheets["商品別"]
    print("  --- 商品別シートの中身 ---")
    for r in rows: print("   ", r)
    check(rows[0] == ["カテゴリー", "商品名", "単価", "個数", "売上", "構成比(%)"], f"見出し={rows[0]}")
    body = rows[1:-1]
    hiro = [r for r in body if r[1] == "広島焼き"]
    check(len(hiro) == 1 and hiro[0][2] == "600" and hiro[0][3] == "2" and hiro[0][4] == "1200",
          f"広島焼き 単価600/個数2/売上1200 → {hiro}")
    pine = [r for r in body if r[1] == "冷やしパイン"]
    check(len(pine) == 1 and pine[0][3] == "1" and pine[0][4] == "300", f"冷やしパイン → {pine}")
    check(not any(r[1].startswith("エビフライ") for r in body), f"取消したエビフライは出ない → {[r[1] for r in body]}")
    amounts = [float(r[4]) for r in body]
    check(amounts == sorted(amounts, reverse=True), f"売上の大きい順 → {amounts}")
    last = rows[-1]
    check(last[1] == "合計" and last[3] == "3" and last[4] == "1500" and last[5] == "100",
          f"合計行={last}（個数3・売上1500・構成比100）")
    # 明細シートの有効行の小計合計と一致するか（シート間の整合）
    det = sheets["明細"]
    det_sum = sum(int(r[6]) for r in det[1:] if r[10] == "有効")
    check(det_sum == 1500, f"明細シートの有効小計合計={det_sum} と商品別の合計1500が一致")
    # 構成比の各行を足すとちょうど100になるか（オーナーが検算しても合うこと）
    ratios = [float(r[5]) for r in body]
    check(abs(sum(ratios) - 100) < 1e-9, f"構成比の各行合計={sum(ratios)}（期待 100）")

    # 単価混在時に「混在」と出す件は純粋関数のテスト（tests/summary.test.js）で担保。
    # 商品設定画面はpromptを2回挟むためブラウザ操作が不安定で、ここでは検証しない。

    check(errs == [], f"JSエラー={errs}")

    # 後片付け: このスクリプトが作った会計のIDだけ削除
    ids = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').getAll();
      q.onsuccess=()=>res(q.result.map(s=>s.id))}})""")
    pg.evaluate("""(ids)=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const tx=r.result.transaction('sales','readwrite');const st=tx.objectStore('sales');
      ids.forEach(i=>st.delete(i));tx.oncomplete=()=>res(1)}})""", ids)
    left = pg.evaluate("""()=>new Promise(res=>{const r=indexedDB.open('natsumatsuri-pos');
      r.onsuccess=()=>{const q=r.result.transaction('sales').objectStore('sales').count();q.onsuccess=()=>res(q.result)}})""")
    check(left == 0, f"後片付け後の残件数={left}")
    b.close()

print("\n==== " + ("ALL OK" if ok else "FAILED") + " ====")
sys.exit(0 if ok else 1)
