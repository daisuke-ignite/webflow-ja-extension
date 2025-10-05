// content.js
// Webflow管理画面のUIテキストを日本語化するコンテンツスクリプト

// utils.jsの関数を利用（manifest.jsonで utils.js → content.js の順で読み込み）

let translationDict = {};
let allowedPatterns = [];

// 英語フォールバック要件: 日本語が無いものは英語のまま出す
// 本スクリプトは部分置換方式のため、用語集に無い語はそのまま（＝英語）を保持するだけで要件を満たす

// 1. CSVファイルの読み込み
async function loadTranslationDict() {
  // 拡張機能パッケージ内のCSVファイルをfetchで取得
  const res = await fetch(chrome.runtime.getURL('translation_terms.csv'));
  const csvText = await res.text();
  // ユーティリティ関数で辞書化
  translationDict = parseTranslationCSV(csvText);
}

// 許可ホストパターンの読み込み
async function loadAllowedPatterns() {
  allowedPatterns = await getAllowedHostPatterns();
}

// 2. テキストノードの部分置換
function replaceTextNode(node) {
  const parentEl = node.parentElement;
  if (parentEl) {
    const tag = parentEl.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') {
      return;
    }
    if (parentEl.isContentEditable) {
      return;
    }
  }
  let text = node.nodeValue;
  let replaced = false;
  for (const [en, ja] of Object.entries(translationDict)) {
    if (text.includes(en)) {
      text = text.replaceAll(en, ja);
      replaced = true;
    }
  }
  if (replaced) {
    node.nodeValue = text;
  }
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
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          replaceTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          walkAndReplace(node);
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 5. 初期化処理
(async function init() {
  await Promise.all([loadTranslationDict(), loadAllowedPatterns()]);
  // ページが許可対象でなければ無効化
  if (!isUrlAllowed(window.location, allowedPatterns)) {
    return;
  }
  walkAndReplace(document.body);
  observeMutations();
})();