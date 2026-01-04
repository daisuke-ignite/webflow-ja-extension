// content.js
// Webflow管理画面のUIテキストを日本語化するコンテンツスクリプト

// utils.jsの関数を利用
// (manifest.jsonでutils.js→content.jsの順で読み込む)

let translationDict = {};

// 1. CSVファイルの読み込み
async function loadTranslationDict() {
  try {
    // 拡張機能パッケージ内のCSVファイルをfetchで取得
    const res = await fetch(chrome.runtime.getURL('translation_terms.csv'));
    if (!res.ok) {
      throw new Error(`CSV読み込み失敗: ${res.status}`);
    }
    const csvText = await res.text();
    // ユーティリティ関数で辞書化
    translationDict = parseTranslationCSV(csvText);
  } catch (error) {
    console.error('[Webflow日本語化] 翻訳辞書の読み込みに失敗しました:', error);
    throw error;
  }
}

// 2. テキストノードの部分置換
function replaceTextNode(node) {
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
  try {
    await loadTranslationDict();
    walkAndReplace(document.body);
    observeMutations();
    console.log('[Webflow日本語化] 翻訳が正常に初期化されました');
  } catch (error) {
    console.error('[Webflow日本語化] 初期化に失敗しました:', error);
  }
})(); 