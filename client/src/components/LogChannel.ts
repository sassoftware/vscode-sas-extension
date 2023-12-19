// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { OutputChannel, l10n, window } from "vscode";

import runStore from "../stores/run";
import { appendLog } from "./LogViewer";
import {
  showLogOnExecutionFinish,
  showLogOnExecutionStart,
} from "./utils/settings";

let outputChannel: OutputChannel;

const { subscribe } = runStore;

export const LogFn = (logs) => {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel(l10n.t("SAS Log"), "sas-log");
  }
  for (const line of logs) {
    appendLog(line.type);
    outputChannel.appendLine(line.line);
  }
};

subscribe(
  (state) => state.isRunning,
  (newValue, oldValue) => {
    if (newValue && !oldValue) {
      if (showLogOnExecutionStart()) {
        outputChannel.show(true);
      }
    } else if (!newValue && oldValue) {
      if (showLogOnExecutionFinish()) {
        outputChannel.show(true);
      }
    }
  },
);
