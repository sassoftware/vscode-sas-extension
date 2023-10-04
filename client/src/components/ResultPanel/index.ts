// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Disposable, Uri, commands, window } from "vscode";

import { createWriteStream } from "fs";

import { SubscriptionProvider } from "../SubscriptionProvider";
import { ResultsContext, resultsHtml } from "./ResultPanel";

export class ResultPanelSubscriptionProvider implements SubscriptionProvider {
  getSubscriptions(): Disposable[] {
    return [
      commands.registerCommand(
        "SAS.saveHTML",
        async (context: ResultsContext) => {
          const html = resultsHtml[context.uuid] || "";
          if (!html) {
            return;
          }
          const uri = await window.showSaveDialog({
            defaultUri: Uri.file(`results.html`),
          });

          if (!uri) {
            return;
          }

          const stream = createWriteStream(uri.fsPath);
          stream.write(html);
          stream.end();
        },
      ),
    ];
  }
}

export default ResultPanelSubscriptionProvider;
