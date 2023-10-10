// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Disposable, Uri, commands, window, workspace } from "vscode";

import { SubscriptionProvider } from "../SubscriptionProvider";
import { ResultsContext, resultPanels } from "./ResultPanel";

export class ResultPanelSubscriptionProvider implements SubscriptionProvider {
  getSubscriptions(): Disposable[] {
    return [
      commands.registerCommand(
        "SAS.saveHTML",
        async (context: ResultsContext) => {
          const panel = resultPanels[context.uuid] || undefined;
          if (!panel) {
            return;
          }
          const uri = await window.showSaveDialog({
            defaultUri: Uri.file(`results.html`),
          });

          if (!uri) {
            return;
          }

          await workspace.fs.writeFile(
            uri,
            new TextEncoder().encode(panel.webview.html),
          );
        },
      ),
    ];
  }
}

export default ResultPanelSubscriptionProvider;
