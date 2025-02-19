// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, window, workspace } from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

import path from "path";

import { exportToHTML } from "./toHTML";
import { exportToSAS } from "./toSAS";

export const exportNotebook = async (client: LanguageClient) => {
  const notebook = window.activeNotebookEditor?.notebook;

  if (!notebook) {
    return;
  }

  const uri = await window.showSaveDialog({
    filters: { SAS: ["sas"], HTML: ["html"] },
    defaultUri: Uri.parse(path.basename(notebook.uri.path, ".sasnb")),
  });

  if (!uri) {
    return;
  }

  const content = uri.path.endsWith(".html")
    ? await exportToHTML(notebook, client)
    : exportToSAS(notebook);

  workspace.fs.writeFile(uri, Buffer.from(content));
};
