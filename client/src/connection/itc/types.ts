// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { BaseConfig } from "..";
import env from "./env.json";

export const LineCodes = {
  LogLineType: env.LineCodes.LogLineType,
  ResultsFetchedCode: env.LineCodes.ResultsFetchedCode,
  RunCancelledCode: env.LineCodes.RunCancelledCode,
  RunEndCode: env.LineCodes.RunEndCode,
  SessionCreatedCode: env.LineCodes.SessionCreatedCode,
};

export enum ScriptActions {
  CreateDirectory = `$runner.CreateDirectory($folderPath, $folderName)`,
  CreateFile = `$runner.CreateFile($folderPath, $fileName, $content)`,
  DeleteFile = `$runner.DeleteFile($filePath)`,
  FetchFileContent = `$runner.FetchFileContent($filePath, $outputFile)`,
  GetChildItems = `$runner.GetChildItems($path, $fileNavigationCustomRootPath, $fileNavigationRoot)`,
  RenameFile = `$runner.RenameFile($oldPath,$newPath,$newName)`,
  UpdateFile = `$runner.UpdateFile($filePath, $content)`,
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
  interopLibraryFolderPath?: string;
}

export type PowershellResponse = {
  category: number;
  creationTimeStamp?: string;
  modifiedTimeStamp: string;
  name: string;
  parentFolderUri: string;
  size: number;
  uri: string;
};
