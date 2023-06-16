// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { commands, ExtensionContext, Uri } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";

import { LanguageClient } from "vscode-languageclient/browser";

let client: LanguageClient;

// this method is called when vs code is activated
export function activate(context: ExtensionContext): void {
  commands.executeCommand("setContext", "SAS.hideRunMenuItem", true);

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for sas file
    documentSelector: [{ language: "sas" }],
  };

  client = createWorkerLanguageClient(context, clientOptions);

  client.start();
}

function createWorkerLanguageClient(
  context: ExtensionContext,
  clientOptions: LanguageClientOptions
) {
  // Create a worker. The worker main file implements the language server.
  const serverMain = Uri.joinPath(
    context.extensionUri,
    "server/dist/browser/server.js"
  );
  const worker = new Worker(serverMain.toString());

  // create the language server client to communicate with the server running in the worker
  return new LanguageClient(
    "sas-lsp",
    "SAS Language Server",
    clientOptions,
    worker
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
