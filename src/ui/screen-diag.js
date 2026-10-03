// 診断画面。現場で「固まった」時の記録を見る（2026-10-03）。
// 新しい順に並べ、アプリを起動し直した所に区切りを入れる。
// 固まった時は「処理が止まっていた」「prompt:開 だけで 閉 が無い」「触れた だけで 押した が無い」が手がかりになる。
import { esc } from './escape.js';
import { go } from './state.js';
import { readDiag, clearDiag } from '../diag.js';
import { BUILD } from '../version.js';

const MARK = new Set(['処理が止まっていた', 'エラー', 'エラー(非同期)', '保存失敗', 'DB作り直し']);

function time(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function renderDiag() {
  const el = document.createElement('div');
  el.className = 'screen';
  const rows = readDiag().reverse();

  el.innerHTML = `
    <div class="bar">
      <button class="bar__btn" data-back>‹ トップ</button>
      <span class="bar__title">診断の記録</span>
      <span class="bar__actions">
        <button class="bar__btn" data-clear-diag>記録を消す</button>
      </span>
    </div>
    <div class="scroll diag">
      <p class="diag__lead">ver ${esc(BUILD)}／${rows.length}件（新しい順）。固まったら、開き直してすぐこの画面をスクリーンショットしてください。<br>
        ※「処理が止まっていた」は、入力窓を開いていた間・裏から戻った直後にも出ます（その時は故障ではありません）。</p>
      ${rows.length === 0 ? '<p class="diag__lead">記録はまだありません。</p>' : rows.map((r) => `
        <div class="diag__row ${r.k === '起動' ? 'diag__row--boot' : ''} ${MARK.has(r.k) ? 'diag__row--bad' : ''}">
          <span class="diag__t">${esc(time(r.t))}</span>
          <span class="diag__k">${esc(r.k)}</span>
          <span class="diag__d">${esc(r.d)}</span>
        </div>`).join('')}
    </div>
  `;

  el.querySelector('[data-back]').addEventListener('click', () => go('top'));
  el.querySelector('[data-clear-diag]').addEventListener('click', () => {
    if (!confirm('診断の記録を消します。売上は消えません。よろしいですか？')) return;
    clearDiag();
    go('diag');
  });
  return el;
}
