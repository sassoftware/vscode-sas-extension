import { appendLog } from "./LogViewer";
import { OutputChannel, window } from "vscode";

let outputChannel: OutputChannel;
export const LogFn = (logs) => {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel("SAS Log", "sas-log");
  }
  outputChannel.show();
  for (const line of logs) {
    appendLog(line.type);
    outputChannel.appendLine(line.line);
  }
};
