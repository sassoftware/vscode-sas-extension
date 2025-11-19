// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { ActivationFunction } from "vscode-notebook-renderer";

let outputIndex = 0;

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
    const currentIndex = outputIndex++;

    let shadow = element.shadowRoot;
    if (!shadow) {
      shadow = element.attachShadow({ mode: "open" });
    }

    const container = document.createElement("div");
    container.style.position = "relative";

    if (context.postMessage) {
      const toolbar = document.createElement("div");
      toolbar.style.cssText = `
        position: absolute;
        top: -22px;
        right: 8px;
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.1s ease;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 4px;
        padding: 2px;
        z-index: 1000;
      `;

      const saveButton = document.createElement("button");
      saveButton.title = "Save Output";
      saveButton.setAttribute("aria-label", "Save Output");
      saveButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M10.012 2H2.5l-.5.5v11l.5.5h11l.5-.5V5l-4-3h-.488zM3 13V3h6v2.5l.5.5h3v7H3zm7-9v2h2l-2-2z"/>
          <path d="M5 7h6v1H5V7zm0 2h6v1H5V9z"/>
        </svg>
      `;
      saveButton.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        background: transparent;
        border: none;
        color: var(--vscode-icon-foreground);
        cursor: pointer;
        border-radius: 3px;
      `;

      saveButton.onmouseover = () => {
        saveButton.style.background = "var(--vscode-toolbar-hoverBackground)";
      };
      saveButton.onmouseout = () => {
        saveButton.style.background = "transparent";
      };

      saveButton.onclick = () => {
        context.postMessage({
          command: "saveOutput",
          outputType: "html",
          content: html,
          mime: data.mime,
          cellIndex: currentIndex,
        });
      };

      toolbar.appendChild(saveButton);
      container.onmouseenter = () => {
        toolbar.style.opacity = "1";
      };
      container.onmouseleave = () => {
        toolbar.style.opacity = "0";
      };

      container.appendChild(toolbar);
    } // Add the HTML content
    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = replaceLast(
      // it's not a whole webview, body not allowed
      html.replace("<body ", "<div "),
      "</body>",
      "</div>",
    );
    container.appendChild(contentDiv);
    shadow.replaceChildren(container);
  },
});
