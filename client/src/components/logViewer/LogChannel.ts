// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { OutputChannel, l10n, window } from "vscode";

import runStore, { subscribe } from "../../stores/run";
import {
  showLogOnExecutionFinish,
  showLogOnExecutionStart,
} from "../utils/settings";
import { appendLog } from "./LogViewer";

let outputChannel: OutputChannel;

const { unsetProducedLogOutput, setProducedLogOutput } = runStore.getState();

export const LogFn = (logs) => {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel(l10n.t("SAS Log"), "sas-log");
  }

  for (const line of logs) {
    appendLog(line.type);
    outputChannel.appendLine(line.line);
  }

  setProducedLogOutput();
};

subscribe(
  (state) => state.isRunning,
  (running, prevRunning) => {
    if (!running && prevRunning) {
      if (showLogOnExecutionFinish()) {
        outputChannel?.show(true);
        unsetProducedLogOutput();
      }
    }
  },
);

subscribe(
  (state) => state.hasProducedLogOutput,
  (loggedOutput, prevLoggedOutput) => {
    if (loggedOutput && !prevLoggedOutput) {
      if (showLogOnExecutionStart()) {
        outputChannel?.show(true);
      }
    }
  },
);
