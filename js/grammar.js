/**
 * YapPad Grammar module stub (0ms spelling & grammar engine implemented in Ticket 06).
 * Provides XSS-safe HTML escaping and pixel-synced backdrop rendering for #editor-backdrop.
 */
(function (global) {
  "use strict";

  const YP = (global.YP = global.YP || global.SN || {});
  global.SN = YP;

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Render text into XSS-safe HTML for #editor-backdrop, wrapping any supplied
   * issue spans [{ start, end, kind }] and preserving trailing newlines so
   * scrollHeight stays pixel-synced with #editor-textarea.
   */
  function renderBackdropHTML(text, issues) {
    const raw = String(text || "");
    const list = Array.isArray(issues) ? issues.slice() : [];

    if (!list.length) {
      const escaped = escapeHTML(raw);
      return raw.endsWith("\n") ? escaped + "\u200b" : escaped;
    }

    list.sort(function (a, b) {
      return a.start - b.start || b.end - a.end;
    });

    let html = "";
    let cursor = 0;

    for (let i = 0; i < list.length; i += 1) {
      const issue = list[i];
      const start = Math.max(cursor, Math.min(raw.length, issue.start | 0));
      const end = Math.max(start, Math.min(raw.length, issue.end | 0));
      if (end <= start) continue;

      if (start > cursor) {
        html += escapeHTML(raw.slice(cursor, start));
      }

      const kind = issue.kind === "grammar"
        ? "err-grammar"
        : issue.kind === "style"
          ? "err-style"
          : "err-spelling";

      html +=
        '<span class="yp-err ' +
        kind +
        '">' +
        escapeHTML(raw.slice(start, end)) +
        "</span>";
      cursor = end;
    }

    if (cursor < raw.length) {
      html += escapeHTML(raw.slice(cursor));
    }

    return raw.endsWith("\n") ? html + "\u200b" : html;
  }

  YP.Grammar = {
    escapeHTML: escapeHTML,
    renderBackdropHTML: renderBackdropHTML,

    analyze: function () {
      return [];
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
