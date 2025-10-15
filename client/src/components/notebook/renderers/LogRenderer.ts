// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { ActivationFunction } from "vscode-notebook-renderer";

import type { LogLine } from "../../../connection";

const colorMap = {
  error: "var(--vscode-editorError-foreground)",
  warning: "var(--vscode-editorWarning-foreground)",
  note: "var(--vscode-editorInfo-foreground)",
};

export const activate: ActivationFunction = (context) => ({
  renderOutputItem(data, element) {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    // Add save button if messaging is available
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

      const logs: LogLine[] = data.json();
      saveButton.onclick = () => {
        context.postMessage({
          command: "saveOutput",
          outputType: "log",
          content: logs,
          mime: data.mime,
        });
      };
      wrapper.appendChild(saveButton);
    }

    // Add the log content
    const root = document.createElement("div");
    root.style.whiteSpace = "pre";
    root.style.fontFamily = "var(--vscode-editor-font-family)";

    const logs: LogLine[] = data.json();
    for (const line of logs) {
      const color = colorMap[line.type];
      const div = document.createElement("div");
      div.innerText = line.line;
      if (color) {
        div.style.color = color;
      }
      root.append(div);
    }
    wrapper.appendChild(root);
    element.replaceChildren(wrapper);
  },
});
