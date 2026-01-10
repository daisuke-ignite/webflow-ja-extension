// content.js
// Webflow管理画面のUIテキストを日本語化するコンテンツスクリプト

// utils.jsの関数を利用（manifest.jsonで utils.js → content.js の順）

let translationDict = {};
let translationPairs = [];

// ノード/処理のキャッシュ
let processedNodes = new WeakSet();
let nodeOriginalTextMap = new WeakMap();
let nodeLastValueMap = new WeakMap();

// 翻訳統計（用語単位）
let termStats = {}; // { en: { ja, count } }
let pendingStatsFlush = null;

// 設定
let debugMode = false;

function isWebflowAdminUI() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // webflow.com 配下だけ
  if (!hostname.endsWith("webflow.com")) return false;

  // 公開サイト(.webflow.io)は対象外（念のため）
  if (hostname.endsWith("webflow.io")) return false;

  // previewは対象
  if (hostname === "preview.webflow.com") return true;

  // Designerは `*.design.webflow.com/` のようなサブドメインで動くことがある
  if (hostname.endsWith(".design.webflow.com")) return true;

  // 管理画面系のパス（必要に応じて増やす）
  const adminPrefixes = [
    "/dashboard",
    "/design",
    "/designer",
    "/editor",
    "/cms",
    "/ecommerce",
    "/memberships",
    "/sites",
    "/account",
    "/settings",
    // 追加候補:
    // "/workspace",
    // "/team",
  ];
  return adminPrefixes.some((p) => pathname.startsWith(p));
}

async function loadSettings() {
  try {
    const res = await chrome.storage.sync.get(["debugMode"]);
    debugMode = Boolean(res.debugMode);
  } catch {
    debugMode = false;
  }
}

async function loadExistingStats() {
  try {
    const res = await chrome.storage.local.get(["termStats"]);
    if (res && res.termStats && typeof res.termStats === "object") {
      termStats = res.termStats;
    }
  } catch {
    // ignore
  }
}

// 1. CSVファイルの読み込み
async function loadTranslationDict() {
  try {
    const url = chrome.runtime.getURL("translation_terms.csv");
    // 拡張機能パッケージ内のCSVファイルをfetchで取得
    const res = await fetch(url);
    const csvText = await res.text();
    // ユーティリティ関数で辞書化
    translationDict = parseTranslationCSV(csvText);
    translationPairs = optimizeTranslationPairs(translationDict);
  } catch (e) {
    throw e;
  }
}

function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return false;
  const tag = parent.tagName;
  return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT";
}

function scheduleStatsFlush() {
  if (pendingStatsFlush) return;
  pendingStatsFlush = setTimeout(async () => {
    pendingStatsFlush = null;
    try {
      await chrome.storage.local.set({
        termStats,
        termStatsUpdatedAt: Date.now(),
      });
    } catch {
      // ignore
    }
  }, 1000);
}

function recordTermStats(termCounts) {
  for (const [en, c] of Object.entries(termCounts)) {
    if (!c) continue;
    const ja = translationDict[en];
    const cur = termStats[en] ?? { ja, count: 0 };
    cur.ja = ja ?? cur.ja;
    cur.count += c;
    termStats[en] = cur;
  }
  scheduleStatsFlush();
}

// 2. テキストノードの部分置換（最適化版 + マッピング統計）
function replaceTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  if (processedNodes.has(node)) {
    // ただし nodeValue が変わっていたら再処理する
    const last = nodeLastValueMap.get(node);
    if (last === node.nodeValue) return;
  }

  if (shouldSkipTextNode(node)) return;

  const originalText = node.nodeValue;
  if (!originalText || originalText.trim().length === 0) return;

  // デバッグ用に元テキストを保持（最初だけ）
  if (!nodeOriginalTextMap.has(node)) nodeOriginalTextMap.set(node, originalText);

  const translated = translateTextWithStats(originalText, translationPairs, {
    skipIfJapanese: true,
    caseInsensitive: false,
  });

  if (translated) {
    node.nodeValue = translated.text;
    recordTermStats(translated.termCounts);
  } else if (debugMode && containsEnglishText(originalText)) {
    // 未翻訳候補として統計に残す（必要最小限：countのみ）
    const key = `__untranslated__:${originalText.slice(0, 120)}`;
    termStats[key] = termStats[key] ?? { ja: "", count: 0 };
    termStats[key].count += 1;
    scheduleStatsFlush();
  }

  processedNodes.add(node);
  nodeLastValueMap.set(node, node.nodeValue);
}

// 3. DOMツリー走査（テキストノードのみ対象）
function walkAndReplace(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  let node;
  while ((node = walker.nextNode())) {
    replaceTextNode(node);
  }
}

// 4. MutationObserverで動的要素にも対応
function observeMutations() {
  const observer = new MutationObserver((mutations) => {
    const textNodes = new Set();
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target?.nodeType === Node.TEXT_NODE) {
        textNodes.add(mutation.target);
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.add(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // 追加要素内のテキストを集めてからまとめて処理
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
          let t;
          while ((t = walker.nextNode())) textNodes.add(t);
        }
      }
    }
    for (const t of textNodes) replaceTextNode(t);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function hookSpaNavigation(onUrlChange) {
  const fire = () => onUrlChange();
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const ret = origPush.apply(this, args);
    fire();
    return ret;
  };
  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args);
    fire();
    return ret;
  };
  window.addEventListener("popstate", fire);
}

// 5. 初期化処理
(async function init() {
  await loadSettings();

  // 管理画面以外では動かさない（最終ゲート）
  const gate = isWebflowAdminUI();
  if (!gate) return;

  await loadExistingStats();
  await loadTranslationDict();
  walkAndReplace(document.body);
  observeMutations();

  // SPA遷移でも継続
  let lastHref = location.href;
  hookSpaNavigation(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    // 画面種別が変わった場合は停止/再開
    if (!isWebflowAdminUI()) return;
    // 再走査（キャッシュはクリア）
    processedNodes = new WeakSet();
    nodeLastValueMap = new WeakMap();
    setTimeout(() => walkAndReplace(document.body), 300);
  });
})(); 