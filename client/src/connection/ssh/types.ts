// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { BaseConfig } from "..";

export interface Config extends BaseConfig {
  host: string;
  username: string;
  saspath: string;
  port: number;
  privateKeyFilePath: string;
}

export enum LineCodes {
  ResultsFetchedCode = "--vscode-sas-extension-results-fetched--",
  RunCancelledCode = "--vscode-sas-extension-run-cancelled--",
  RunEndCode = "--vscode-sas-extension-submit-end--",
  LogLineType = "--vscode-sas-extension-log-line-type--",
}
