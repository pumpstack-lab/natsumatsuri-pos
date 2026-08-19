const DB_NAME = 'natsumatsuri-pos';
const DB_VERSION = 1;
const STORE_SALES = 'sales';
const STORE_PRODUCTS = 'products';
const STORE_META = 'meta';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putSale(sale) {
  const db = await openDb();
  return asPromise(tx(db, STORE_SALES, 'readwrite').put(sale));
}

export async function getAllSales() {
  const db = await openDb();
  const all = await asPromise(tx(db, STORE_SALES, 'readonly').getAll());
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function putProducts(products) {
  const db = await openDb();
  const store = tx(db, STORE_PRODUCTS, 'readwrite');
  await Promise.all(products.map((p) => asPromise(store.put(p))));
}

export async function getAllProducts() {
  const db = await openDb();
  return asPromise(tx(db, STORE_PRODUCTS, 'readonly').getAll());
}

export async function deleteProduct(id) {
  const db = await openDb();
  return asPromise(tx(db, STORE_PRODUCTS, 'readwrite').delete(id));
}

export async function getMeta(key, fallback = null) {
  const db = await openDb();
  const row = await asPromise(tx(db, STORE_META, 'readonly').get(key));
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  const db = await openDb();
  return asPromise(tx(db, STORE_META, 'readwrite').put({ key, value }));
}
