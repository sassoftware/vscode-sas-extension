import { BaseConfig, LogLineTypeEnum } from "..";

export interface Config extends BaseConfig {
  host: string;
  username: string;
  saspath: string;
  port: number;
  privateKeyFilePath: string;
}

export const LogLineTypes: LogLineTypeEnum[] = [
  "normal",
  "hilighted",
  "source",
  "title",
  "byline",
  "footnote",
  "error",
  "warning",
  "note",
  "message",
];

export enum LineCodes {
  ResultsFetchedCode = "--vscode-sas-extension-results-fetched--",
  RunCancelledCode = "--vscode-sas-extension-run-cancelled--",
  RunEndCode = "--vscode-sas-extension-submit-end--",
  LogLineType = "--vscode-sas-extension-log-line-type--",
}
