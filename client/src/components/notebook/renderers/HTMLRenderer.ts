// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ActivationFunction } from "vscode-notebook-renderer";

/**
 * Replace the last occurrence of a substring
 */
function replaceLast(
  base: string,
  searchValue: string,
  replaceValue: string
): string {
  const index = base.lastIndexOf(searchValue);
  if (index < 0) {
    return base;
  }
  return (
    base.slice(0, index) + replaceValue + base.slice(index + searchValue.length)
  );
}

export const activate: ActivationFunction = () => ({
  renderOutputItem(data, element) {
    const html = data.text();
    let shadow = element.shadowRoot;
    if (!shadow) {
      shadow = element.attachShadow({ mode: "open" });
    }
    shadow.innerHTML = replaceLast(
      // it's not a whole webview, body not allowed
      html.replace("<body ", "<div "),
      "</body>",
      "</div>"
    );
  },
});
