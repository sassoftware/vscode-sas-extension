// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { BaseConfig } from "..";

export enum LineCodes {
  ResultsFetchedCode = "--vscode-sas-extension-results-fetched--",
  RunCancelledCode = "--vscode-sas-extension-run-cancelled--",
  RunEndCode = "--vscode-sas-extension-submit-end--",
  SessionCreatedCode = "--vscode-sas-extension-session-created--",
  LogLineType = "--vscode-sas-extension-log-line-type--",
}

export enum ITCProtocol {
  COM = 0,
  IOMBridge = 2,
}

/**
 * Configuration parameters for this connection provider
 */
export interface Config extends BaseConfig {
  host: string;
  port: number;
  username: string;
  protocol: ITCProtocol;
}
