// utils.js
// 共通ユーティリティ関数（CSVパース、ホスト許可パターン管理、ワイルドカードマッチなど）

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

/**
 * ワイルドカードパターン（*のみ特別扱い）を正規表現に変換
 * 例: *.example.com -> /^.*\.example\.com$/
 */
function wildcardToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|\[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

/**
 * 現在URLが許可パターンに一致するか
 * パターンは以下いずれか:
 *  - ホストのみ（例: *.ocdia.com）
 *  - フルURL（例: https://admin.ocdia.com/*）
 */
function isUrlAllowed(locationLike, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  const currentUrl = String(locationLike.href || window.location.href);
  const currentHost = String(locationLike.hostname || window.location.hostname);
  for (const pattern of patterns) {
    if (!pattern || typeof pattern !== 'string') continue;
    const trimmed = pattern.trim();
    if (trimmed.includes('://')) {
      // フルURLマッチ（スキーム/パス含む）
      const re = wildcardToRegExp(trimmed);
      if (re.test(currentUrl)) return true;
    } else {
      // ホスト名マッチ
      const re = wildcardToRegExp(trimmed);
      if (re.test(currentHost)) return true;
    }
  }
  return false;
}

// chrome.storage キー名
const STORAGE_KEYS = {
  allowedHostPatterns: 'allowedHostPatterns'
};

/**
 * 許可ホストパターンを取得（未設定時は空配列）
 */
async function getAllowedHostPatterns() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([STORAGE_KEYS.allowedHostPatterns], (items) => {
        const patterns = items[STORAGE_KEYS.allowedHostPatterns];
        resolve(Array.isArray(patterns) ? patterns : []);
      });
    } catch (_) {
      resolve([]);
    }
  });
}

/**
 * 許可ホストパターンを保存
 */
async function setAllowedHostPatterns(patterns) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEYS.allowedHostPatterns]: Array.from(new Set(patterns)) }, () => resolve());
    } catch (_) {
      resolve();
    }
  });
}

// グローバル公開（content/options 双方で利用）
// eslint-disable-next-line no-undef
self.parseTranslationCSV = parseTranslationCSV;
// eslint-disable-next-line no-undef
self.wildcardToRegExp = wildcardToRegExp;
// eslint-disable-next-line no-undef
self.isUrlAllowed = isUrlAllowed;
// eslint-disable-next-line no-undef
self.getAllowedHostPatterns = getAllowedHostPatterns;
// eslint-disable-next-line no-undef
self.setAllowedHostPatterns = setAllowedHostPatterns;