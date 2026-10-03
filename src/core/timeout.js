// 返ってこない処理を打ち切る。
// iPad内の保存（IndexedDB）が成功も失敗も返さず止まると、二重登録防止フラグが
// 立ったままになり「支払い完了」が二度と効かなくなる（2026-10-03 再現・実測）。
// 打ち切って失敗として扱えば、画面は「もう一度押してください」に戻れる。
export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label} が ${ms}ms 以内に終わらなかった`);
      e.name = 'TimeoutError';
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
