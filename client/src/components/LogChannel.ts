// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { OutputChannel, l10n, window } from "vscode";

import { appendLog } from "./LogViewer";

let outputChannel: OutputChannel;
if (!outputChannel) {
  outputChannel = window.createOutputChannel(l10n.t("SAS Log"), "sas-log");
}
export { outputChannel };
export const LogFn = (logs) => {
  for (const line of logs) {
    appendLog(line.type);
    outputChannel.appendLine(line.line);
  }
};
