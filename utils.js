// utils.js
// 共通ユーティリティ関数（CSVパース、テキスト置換など）

/**
 * CSVテキストをパースし、英語→日本語の辞書オブジェクトを返す
 * @param {string} csvText - CSVファイルのテキスト
 * @returns {Object} - { 英語: 日本語, ... } の辞書
 */
function parseTranslationCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const dict = {};
  // 1行目はヘッダーなのでスキップ
  for (let i = 1; i < lines.length; i++) {
    const [en, ja] = lines[i].split(',');
    if (en && ja) {
      dict[en.trim()] = ja.trim();
    }
  }
  return dict;
}

// --- 他のユーティリティ関数は後で追加 --- 