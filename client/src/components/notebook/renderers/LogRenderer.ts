// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { ActivationFunction } from "vscode-notebook-renderer";

import type { LogLine } from "../../../connection";

let outputIndex = 0;

const colorMap = {
  error: "var(--vscode-editorError-foreground)",
  warning: "var(--vscode-editorWarning-foreground)",
  note: "var(--vscode-editorInfo-foreground)",
};

export const activate: ActivationFunction = (context) => ({
  renderOutputItem(data, element) {
    const logs: LogLine[] = data.json();
    const currentIndex = outputIndex++;

    const container = document.createElement("div");
    container.style.position = "relative";

    if (context.postMessage) {
      const toolbar = document.createElement("div");
      toolbar.style.cssText = `
        position: absolute;
        top: 4px;
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.1s ease;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 4px;
        padding: 2px;
        z-index: 1000;
        margin: 4px 4px 0 0;
      `;

      const saveButton = document.createElement("button");
      saveButton.title = "Save Output";
      saveButton.setAttribute("aria-label", "Save Output");
      saveButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
          <path d="M13.5 1h-12l-.5.5v13l.5.5h13l.5-.5v-12l-.5-.5zM13 14H2V2h10v1H4v1h8v10zm-1-9H4V4h8v1z"/>
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
          outputType: "log",
          content: logs,
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
    }

    const root = document.createElement("div");
    root.style.whiteSpace = "pre";
    root.style.fontFamily = "var(--vscode-editor-font-family)";

    for (const line of logs) {
      const color = colorMap[line.type];
      const div = document.createElement("div");
      div.innerText = line.line;
      if (color) {
        div.style.color = color;
      }
      root.append(div);
    }
    container.appendChild(root);
    element.replaceChildren(container);
  },
});
