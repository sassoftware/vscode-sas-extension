// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { ActivationFunction } from "vscode-notebook-renderer";

/**
 * Replace the last occurrence of a substring
 */
function replaceLast(
  base: string,
  searchValue: string,
  replaceValue: string,
): string {
  const index = base.lastIndexOf(searchValue);
  if (index < 0) {
    return base;
  }
  return (
    base.slice(0, index) + replaceValue + base.slice(index + searchValue.length)
  );
}

export const activate: ActivationFunction = (context) => ({
  renderOutputItem(data, element) {
    const html = data.text();
    let shadow = element.shadowRoot;
    if (!shadow) {
      shadow = element.attachShadow({ mode: "open" });
    }

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    if (context.postMessage) {
      const saveButton = document.createElement("button");
      saveButton.textContent = "Save Output";
      saveButton.title = "Save this output to a file";
      saveButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 4px 8px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 2px;
        cursor: pointer;
        font-size: 12px;
        z-index: 1000;
      `;
      saveButton.onmouseover = () => {
        saveButton.style.background = "var(--vscode-button-hoverBackground)";
      };
      saveButton.onmouseout = () => {
        saveButton.style.background = "var(--vscode-button-background)";
      };

      saveButton.onclick = () => {
        context.postMessage({
          command: "saveOutput",
          outputType: "html",
          content: html,
          mime: data.mime,
        });
      };
      wrapper.appendChild(saveButton);
    }

    // Add the HTML content
    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = replaceLast(
      // it's not a whole webview, body not allowed
      html.replace("<body ", "<div "),
      "</body>",
      "</div>",
    );
    wrapper.appendChild(contentDiv);
    shadow.replaceChildren(wrapper);
  },
});
