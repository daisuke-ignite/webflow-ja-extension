// utils.js
// 共通ユーティリティ関数（CSVパース、テキスト置換、翻訳エンジンなど）

/**
 * CSVテキストをパースし、英語→日本語の辞書オブジェクトを返す
 * @param {string} csvText - CSVファイルのテキスト
 * @returns {Object} - { 英語: 日本語, ... } の辞書
 */
function parseTranslationCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  const dict = {};

  // 1行目はヘッダー想定。空行や不正行もスキップ。
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row) continue;
    const cols = parseCSVRow(row);
    if (!cols || cols.length < 2) continue;
    const en = (cols[0] ?? "").trim();
    const ja = (cols[1] ?? "").trim();
    if (!en || !ja) continue;
    dict[en] = ja;
  }
  return dict;
}

/**
 * 最小CSVパーサ（ダブルクォートで囲まれたカンマを許容）
 * 例: "Save, Draft",保存(下書き)
 */
function parseCSVRow(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // "" はエスケープされた " とみなす
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAlreadyTranslated(text) {
  // ひらがな/カタカナ/漢字が含まれるなら翻訳済み扱い
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
}

function containsEnglishText(text) {
  // 3文字以上の英単語があるか（雑に候補抽出）
  return /\b[A-Za-z]{3,}\b/.test(text) && !isAlreadyTranslated(text);
}

function optimizeTranslationPairs(dict) {
  // 長いキーから先に置換（部分一致の食い合いを軽減）
  return Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
}

/**
 * 置換の回数を数える（重複は許容、単純な部分一致）
 */
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count++;
    idx += needle.length;
  }
  return count;
}

/**
 * テキストを翻訳し、どの用語が何回置換されたかも返す
 * @returns {{ text: string, termCounts: Record<string, number> } | null}
 */
function translateTextWithStats(inputText, pairs, opts = {}) {
  const { skipIfJapanese = true, caseInsensitive = false } = opts;
  if (!inputText) return null;
  if (skipIfJapanese && isAlreadyTranslated(inputText)) return null;

  let text = inputText;
  let changed = false;
  const termCounts = {};

  for (const [en, ja] of pairs) {
    if (!en) continue;

    if (caseInsensitive) {
      const re = new RegExp(escapeRegex(en), "gi");
      if (!re.test(text)) continue;
      // 回数推定（厳密ではないが実用上OK）
      const before = text;
      text = text.replace(re, ja);
      if (text !== before) {
        changed = true;
        // 簡易カウント：before上での出現回数を使う
        termCounts[en] = (termCounts[en] ?? 0) + (before.match(re)?.length ?? 0);
      }
    } else {
      if (!text.includes(en)) continue;
      const c = countOccurrences(text, en);
      text = text.replaceAll(en, ja);
      if (c > 0) {
        changed = true;
        termCounts[en] = (termCounts[en] ?? 0) + c;
      }
    }
  }

  return changed ? { text, termCounts } : null;
}