// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import type { ActivationFunction } from "vscode-notebook-renderer";
import type { LogLine } from "../../../connection";

const colorMap = {
  error: "var(--vscode-editorError-foreground)",
  warning: "var(--vscode-editorWarning-foreground)",
  note: "var(--vscode-editorInfo-foreground)",
};

export const activate: ActivationFunction = () => ({
  renderOutputItem(data, element) {
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
    element.replaceChildren(root);
  },
});
