import { withTimeout } from './core/timeout.js';
import { diag } from './diag.js';

const DB_NAME = 'natsumatsuri-pos';
const DB_VERSION = 1;
const STORE_SALES = 'sales';
const STORE_PRODUCTS = 'products';
const STORE_META = 'meta';

// 保存・読み込みの打ち切り時間。普段は数十ms で終わる。
// これを超えたら「止まった」とみなして失敗にし、次の操作で接続を作り直す（2026-10-03）。
const OP_TIMEOUT_MS = 5000;

let dbPromise = null;

// 接続を捨てて、次の操作で開き直させる。
// 以前は一度作った接続を使い回し続けたため、iPad側で接続が切れると
// 「保存できませんでした」がアプリを開き直すまで出続けた（2026-10-03 再現・実測）。
function resetDb(reason) {
  const old = dbPromise;
  dbPromise = null;
  diag('DB作り直し', reason);
  if (old) old.then((db) => { try { db.close(); } catch { /* 無視 */ } }).catch(() => {});
}

function openDb() {
  if (dbPromise) return dbPromise;
  const opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        db.createObjectStore(STORE_SALES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // ブラウザ側から接続を閉じられた時は、次の操作で開き直す
      db.onclose = () => { if (dbPromise === current) resetDb('接続が閉じられた'); };
      db.onversionchange = () => { if (dbPromise === current) resetDb('別の画面がDBを更新'); };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => diag('DB', '開くのを待たされている(blocked)');
  });
  const current = withTimeout(opening, OP_TIMEOUT_MS, 'DBを開く');
  dbPromise = current;
  // 開くのに失敗した接続を使い回さない
  current.catch((e) => { if (dbPromise === current) resetDb(`開けなかった: ${e && e.name}`); });
  // 時間切れのあとで遅れて開いた接続は使わないので閉じる
  opening.then((db) => { if (dbPromise !== current) { try { db.close(); } catch { /* 無視 */ } } }).catch(() => {});
  return current;
}

// 1回の読み書きを「接続→処理→完了待ち」まで時間制限付きで行う。
// 失敗・時間切れなら接続を捨てて、次の操作で開き直す。
// fn(store) は IDBRequest を返す（値が欲しい時）か、何も返さない（完了だけ待つ時）。
async function run(storeName, mode, fn, label) {
  const started = Date.now();
  const writing = mode === 'readwrite';
  if (writing) diag('保存開始', label);
  const attempt = async () => {
    const db = await openDb();
    let t;
    try {
      t = db.transaction(storeName, mode);
    } catch (e) {
      // 接続が閉じられていると、ここで即座に失敗する（まだ何も書いていない）
      e.beforeWrite = true;
      throw e;
    }
    const req = fn(t.objectStore(storeName));
    // 書き込みは「依頼が通った」ではなく「確定した(complete)」まで待つ
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('transaction aborted'));
    });
  };
  try {
    const result = await withTimeout((async () => {
      try {
        return await attempt();
      } catch (e) {
        if (!e || !e.beforeWrite) throw e;
        // 何も書く前に接続切れで失敗した時だけ、開き直して1回やり直す。
        // 書いていないので二重登録の心配がなく、職員に「保存できませんでした」を見せずに済む。
        resetDb(`${label}: 接続が切れていたので開き直し`);
        return attempt();
      }
    })(), OP_TIMEOUT_MS, label);
    if (writing) diag('保存完了', `${label} ${Date.now() - started}ms`);
    return result;
  } catch (e) {
    diag('保存失敗', `${label} ${Date.now() - started}ms ${e && e.name}: ${e && e.message}`);
    resetDb(`${label} が失敗`);
    throw e;
  }
}

export async function putSale(sale) {
  return run(STORE_SALES, 'readwrite', (store) => store.put(sale), `会計 ${sale.terminal}-${sale.seq}`);
}

export async function getAllSales() {
  const all = await run(STORE_SALES, 'readonly', (store) => store.getAll(), '会計の読み込み');
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function putProducts(products) {
  await run(STORE_PRODUCTS, 'readwrite', (store) => { products.forEach((p) => store.put(p)); }, `商品 ${products.length}件`);
}

// 指定したidの商品を端末から消す。廃止した商品の後始末に使う。
// put だけでは「マージ結果から外れた商品」が端末に残り続けるため
// （2026-10-01 レスポ入れ替えで実測・旧商品がDBに残っていた）。
export async function deleteProductsByIds(ids) {
  if (ids.length === 0) return 0;
  await run(STORE_PRODUCTS, 'readwrite', (store) => { ids.forEach((id) => store.delete(id)); }, `廃止商品の削除 ${ids.length}件`);
  return ids.length;
}

export async function getAllProducts() {
  return run(STORE_PRODUCTS, 'readonly', (store) => store.getAll(), '商品の読み込み');
}

export async function deleteProduct(id) {
  return run(STORE_PRODUCTS, 'readwrite', (store) => store.delete(id), `商品の削除 ${id}`);
}

export async function getMeta(key, fallback = null) {
  const row = await run(STORE_META, 'readonly', (store) => store.get(key), `設定の読み込み ${key}`);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  return run(STORE_META, 'readwrite', (store) => store.put({ key, value }), `設定の保存 ${key}`);
}

export async function deleteMeta(key) {
  return run(STORE_META, 'readwrite', (store) => store.delete(key), `設定の削除 ${key}`);
}

// 指定したIDの売上だけを消す。イベント単位の消去に使う。
// clearSales()（全消去）は他イベントを巻き込むため画面からは呼ばない。
export async function deleteSalesByIds(ids) {
  await run(STORE_SALES, 'readwrite', (store) => { ids.forEach((id) => store.delete(id)); }, `会計の消去 ${ids.length}件`);
  return ids.length;
}

export async function clearSales() {
  await run(STORE_SALES, 'readwrite', (store) => store.clear(), '会計の全消去');
  await deleteMeta('last_sync_at');
}
