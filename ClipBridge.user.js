// ==UserScript==
// @name         ClipBridge - Force Copy to Windows Clipboard
// @name:zh-CN   ClipBridge - 让无痕复制进入 Windows 剪贴板历史
// @namespace    https://github.com/shenyouchudegou/ClipBridge
// @version      1.1.2
// @description  Re-write copied text through Tampermonkey so Windows clipboard history can capture copies made in private browsing.
// @description:zh-CN 拦截无痕窗口中的复制，通过 Tampermonkey 重写纯文本，使 Windows 剪贴板历史可以捕获。
// @author       ClipBridge
// @homepageURL  https://github.com/shenyouchudegou/ClipBridge
// @supportURL   https://github.com/shenyouchudegou/ClipBridge/issues
// @downloadURL  https://raw.githubusercontent.com/shenyouchudegou/ClipBridge/main/ClipBridge.user.js
// @updateURL    https://raw.githubusercontent.com/shenyouchudegou/ClipBridge/main/ClipBridge.user.js
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @run-in       incognito-tabs
// @grant        GM_setClipboard
// ==/UserScript==

(() => {
  'use strict';

  const DEBUG = false;
  let clipboardWriteInProgress = false;

  const log = (...args) => {
    if (DEBUG) console.debug('[ClipBridge]', ...args);
  };

  log('Injected', {
    url: location.href,
    frame: window.top === window ? 'top' : 'iframe',
  });

  /**
   * Return the focused element, including an element inside an open shadow root.
   */
  function getDeepActiveElement() {
    let active = document.activeElement;

    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }

    return active;
  }

  function isTextControl(element) {
    if (element instanceof HTMLTextAreaElement) return true;
    if (!(element instanceof HTMLInputElement)) return false;

    return /^(text|search|tel|url|email)$/i.test(element.type);
  }

  function selectedTextInControl(element) {
    if (!isTextControl(element)) return null;

    const start = element.selectionStart;
    const end = element.selectionEnd;

    if (typeof start !== 'number' || typeof end !== 'number' || start === end) {
      return '';
    }

    return element.value.slice(Math.min(start, end), Math.max(start, end));
  }

  /**
   * Prefer an input/textarea selection. If focus is in such a control and it has
   * no selection, do not accidentally copy an old selection elsewhere on the page.
   */
  function getSelectedText(event) {
    const candidates = [
      event?.composedPath?.()[0],
      getDeepActiveElement(),
    ];

    for (const candidate of candidates) {
      const controlSelection = selectedTextInControl(candidate);
      if (controlSelection !== null) return controlSelection;
    }

    return document.getSelection()?.toString() ?? '';
  }

  function writeToWindowsClipboard(text) {
    if (clipboardWriteInProgress) {
      log('Skipped a re-entrant clipboard write');
      return false;
    }

    clipboardWriteInProgress = true;
    log(`Requesting clipboard write for ${text.length} character(s)`);

    // The callback is the normal unlock path. The timer prevents the script
    // from remaining locked if a userscript manager omits the callback.
    const resetTimer = setTimeout(() => {
      clipboardWriteInProgress = false;
    }, 1000);

    const finishWrite = () => {
      clearTimeout(resetTimer);
      clipboardWriteInProgress = false;
    };

    try {
      // Do not also write event.clipboardData here. A renderer-side clipboard
      // write in an incognito tab may restore Chromium's "no history" marker.
      GM_setClipboard(
        text,
        'text',
        () => {
          finishWrite();
          log(`Copied ${text.length} character(s)`);
        },
      );
      return true;
    } catch (error) {
      finishWrite();
      console.warn('[ClipBridge] Unable to write through Tampermonkey.', error);
      return false;
    }
  }

  function isCopyShortcut(event) {
    if (event.repeat || event.altKey || event.metaKey) return false;

    const ctrlC = event.ctrlKey
      && (event.code === 'KeyC' || event.key?.toLowerCase() === 'c');
    const ctrlInsert = event.ctrlKey && (event.code === 'Insert' || event.key === 'Insert');

    return ctrlC || ctrlInsert;
  }

  function intercept(event, text, deferWrite = false) {
    log(`Intercepted ${event.type}`, {
      characters: text.length,
      deferred: deferWrite,
    });

    // Block page handlers registered farther down the event path from replacing
    // the text. More importantly, cancel Chromium's native incognito clipboard
    // write so it cannot add the Windows "do not keep in history" marker.
    event.preventDefault();
    event.stopImmediatePropagation();

    if (deferWrite) {
      // Calling execCommand('copy') from inside a copy event is recursive, so
      // context-menu Copy must wait until the current copy dispatch has ended.
      setTimeout(() => writeToWindowsClipboard(text), 0);
      return;
    }

    // Keep Ctrl+C inside the trusted keyboard gesture. The re-entry guard lets
    // Tampermonkey's internal copy event pass without calling GM_setClipboard again.
    writeToWindowsClipboard(text);
  }

  window.addEventListener('keydown', (event) => {
    if (!event.isTrusted || !isCopyShortcut(event)) return;

    const text = getSelectedText(event);
    if (!text) return;

    intercept(event, text);
  }, { capture: true });

  // Covers context-menu Copy and other browser/UI paths that emit a copy event.
  window.addEventListener('copy', (event) => {
    // Let the internal copy operation used by GM_setClipboard proceed.
    if (clipboardWriteInProgress) return;
    if (!event.isTrusted) return;

    const text = getSelectedText(event);
    if (!text) return;

    intercept(event, text, true);
  }, { capture: true });
})();
