// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Disposable, Uri, commands, window, workspace } from "vscode";

import { SubscriptionProvider } from "../SubscriptionProvider";
import { resultPanelManager } from "./ResultPanelManager";

interface ResultPanelContext {
  webview: string;
  resultPanelId: string;
}
export class ResultPanelSubscriptionProvider implements SubscriptionProvider {
  getSubscriptions(): Disposable[] {
    return [
      commands.registerCommand(
        "SAS.saveHTML",
        async (context: ResultPanelContext) => {
          const panelHtml = resultPanelManager.fetchHtmlFor(
            context.resultPanelId,
          );

          if (panelHtml.length === 0) {
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
            new TextEncoder().encode(panelHtml),
          );
        },
      ),
    ];
  }
}
