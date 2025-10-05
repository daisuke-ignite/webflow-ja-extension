// options.js
// オプションページのロジック（用語集表示、部分置換プレビュー、許可ホスト設定）

let translationDict = {};
let hostPatterns = [];

// 用語集をテーブル表示
async function showTranslationTable() {
  // CSVファイルをfetch
  const res = await fetch(chrome.runtime.getURL('translation_terms.csv'));
  const csvText = await res.text();
  // ユーティリティ関数で辞書化
  translationDict = parseTranslationCSV(csvText);

  // テーブル要素を作成
  const table = document.createElement('table');
  table.border = 1;
  // ヘッダー
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>英語 (English)</th><th>日本語 (Japanese)</th></tr>';
  table.appendChild(thead);
  // 本体
  const tbody = document.createElement('tbody');
  for (const [en, ja] of Object.entries(translationDict)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${en}</td><td>${ja}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  // ページに追加
  document.body.appendChild(table);
}

// 部分置換プレビュー機能
function previewPartialReplace() {
  const input = document.getElementById('preview-input').value;
  let result = input;
  // 用語集で部分置換
  for (const [en, ja] of Object.entries(translationDict)) {
    if (result.includes(en)) {
      result = result.replaceAll(en, ja);
    }
  }
  document.getElementById('preview-result').textContent = `翻訳結果: ${result}`;
}

// --- 許可ホスト/URLパターン設定 ---
function renderHostPatterns() {
  const list = document.getElementById('host-pattern-list');
  list.innerHTML = '';
  for (const pattern of hostPatterns) {
    const li = document.createElement('li');
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '削除';
    removeBtn.addEventListener('click', async () => {
      hostPatterns = hostPatterns.filter((p) => p !== pattern);
      await setAllowedHostPatterns(hostPatterns);
      renderHostPatterns();
    });
    const code = document.createElement('code');
    code.textContent = pattern;
    li.appendChild(code);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(removeBtn);
    list.appendChild(li);
  }
}

async function initHostPatterns() {
  hostPatterns = await getAllowedHostPatterns();
  // 既定値が未設定ならOCディア用を初期投入
  if (!Array.isArray(hostPatterns) || hostPatterns.length === 0) {
    hostPatterns = ['*.ocdia.com', 'https://admin.ocdia.com/*'];
    await setAllowedHostPatterns(hostPatterns);
  }
  renderHostPatterns();
}

function wireHostPatternControls() {
  document.getElementById('add-host-pattern').addEventListener('click', async () => {
    const input = document.getElementById('host-pattern-input');
    const value = (input.value || '').trim();
    if (!value) return;
    if (!hostPatterns.includes(value)) {
      hostPatterns.push(value);
      await setAllowedHostPatterns(hostPatterns);
      renderHostPatterns();
    }
    input.value = '';
  });
}

// ページロード時に表示
window.addEventListener('DOMContentLoaded', () => {
  showTranslationTable();
  // プレビューボタンにイベント追加
  document.getElementById('preview-btn').addEventListener('click', previewPartialReplace);
  // 許可ホスト初期化
  initHostPatterns();
  wireHostPatternControls();
}); 