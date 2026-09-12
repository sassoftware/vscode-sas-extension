// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Thin wrapper around VS Code's theme CSS variables. The webview HTML root
// gets a `vscode-light`, `vscode-dark`, or `vscode-high-contrast` class
// applied automatically by the host; we read it here to drive a few
// JS-time decisions (e.g. icon polarity).

export type ThemeKind = "light" | "dark" | "high-contrast";

export function detectTheme(): ThemeKind {
  const cls = document.body.classList;
  if (cls.contains("vscode-high-contrast")) {
    return "high-contrast";
  }
  if (cls.contains("vscode-dark")) {
    return "dark";
  }
  return "light";
}

export function watchTheme(cb: (theme: ThemeKind) => void): () => void {
  const observer = new MutationObserver(() => cb(detectTheme()));
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

/**
 * Read the localisation bundle the host serialised onto `<body data-l10n>`.
 * Falls back to the english string if the key is absent.
 */
let bundle: Record<string, string> | undefined;
export function l10n(key: string): string {
  if (!bundle) {
    try {
      bundle = JSON.parse(document.body.dataset.l10n || "{}");
    } catch {
      bundle = {};
    }
  }
  return bundle[key] ?? key;
}
