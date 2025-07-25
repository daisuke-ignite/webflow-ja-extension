// options.js
// オプションページのロジック（用語集表示、部分置換プレビューなど）

let translationDict = {};

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

// ページロード時に表示
window.addEventListener('DOMContentLoaded', () => {
  showTranslationTable();
  // プレビューボタンにイベント追加
  document.getElementById('preview-btn').addEventListener('click', previewPartialReplace);
}); 