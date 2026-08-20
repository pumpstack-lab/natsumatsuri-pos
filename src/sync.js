// 本部Wi-Fiでの合算用の同期（Supabase REST）。
// 屋台での登録はこのファイルが死んでいても一切影響しない（完全オフライン設計は不変）。
// キーはリポジトリに置かず、端末のIndexedDB(meta)にのみ保存する。
import { getMeta, setMeta, getAllSales } from './db.js';
import { toRow, fromRow } from './core/syncrow.js';

export const SYNC_URL = 'https://vqeoutrlvdydxenaspas.supabase.co';

export async function getSyncKey() {
  return getMeta('sync_key', null);
}

export async function setSyncKey(key) {
  return setMeta('sync_key', (key ?? '').trim());
}

async function upsert(rows, key) {
  const res = await fetch(`${SYNC_URL}/rest/v1/nm_sales?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`sync ${res.status}: ${(await res.text()).slice(0, 120)}`);
}

// 全会計を送信（idで冪等・二重送信しても重複しない）。
// 成功時は送信済み時刻を返す。オフライン・キー未設定なら何もしない。
export async function pushAll() {
  const key = await getSyncKey();
  if (!key || !navigator.onLine) return { pushed: 0, skipped: true };
  const sales = await getAllSales();
  if (sales.length === 0) return { pushed: 0, skipped: false };
  const rows = sales.map((s) => toRow(s));
  // 一度に大きすぎるpayloadを避けて100件ずつ
  for (let i = 0; i < rows.length; i += 100) {
    await upsert(rows.slice(i, i + 100), key);
  }
  await setMeta('last_sync_at', new Date().toISOString());
  return { pushed: rows.length, skipped: false };
}

// 全端末分を取得（合算履歴用）
export async function fetchAll() {
  const key = await getSyncKey();
  if (!key) throw new Error('NO_KEY');
  const res = await fetch(`${SYNC_URL}/rest/v1/nm_sales?select=*&order=created_at.desc&limit=2000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const rows = await res.json();
  return rows.map(fromRow);  // アプリ内の形式に戻す（summarize等を再利用するため）
}
