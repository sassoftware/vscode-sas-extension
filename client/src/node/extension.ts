// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import * as path from "path";
import {
  commands,
  ExtensionContext,
  languages,
  StatusBarAlignment,
  StatusBarItem,
  window,
  workspace,
} from "vscode";
import { run } from "../commands/run";
import { closeSession } from "../commands/closeSession";
import * as configuration from "../components/config";
import { create as activeProfileTrackerCreate } from "../components/activeProfileTracker";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { LogTokensProvider, legend } from "../LogViewer";
import {
  profileConfig,
  addProfile,
  updateProfile,
  switchProfile,
  deleteProfile,
} from "../commands/profile";

let client: LanguageClient;
// Create Profile status bar item
const activeProfileStatusBarIcon = window.createStatusBarItem(
  StatusBarAlignment.Left,
  0
);

export function activate(context: ExtensionContext): void {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "dist", "node", "server.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for sas file
    documentSelector: [{ language: "sas" }],
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "sas-lsp",
    "SAS Language Server",
    serverOptions,
    clientOptions
  );

  activeProfileStatusBarIcon.command = "SAS.session.switchProfile";

  // Start the client. This will also launch the server
  client.start();

  context.subscriptions.push(
    commands.registerCommand("SAS.session.run", run),
    commands.registerCommand("SAS.session.close", () => closeSession(false)),
    commands.registerCommand("SAS.session.switchProfile", switchProfile),
    commands.registerCommand("SAS.session.addProfile", addProfile),
    commands.registerCommand("SAS.session.deleteProfile", deleteProfile),
    commands.registerCommand("SAS.session.updateProfile", updateProfile),
    languages.registerDocumentSemanticTokensProvider(
      { language: "sas-log" },
      LogTokensProvider,
      legend
    ),
    activeProfileStatusBarIcon
  );

  // First iteration
  updateStatusBarProfile(activeProfileStatusBarIcon);
  // Set watcher to update if profile changes
  activeProfileTrackerCreate(profileConfig, configuration.getConfigFile(), () =>
    updateStatusBarProfile(activeProfileStatusBarIcon)
  );
}

async function updateStatusBarProfile(profileStatusBarIcon: StatusBarItem) {
  const currentProfile = await profileConfig.getActiveProfile();
  if (!currentProfile) {
    resetStatusBarItem(profileStatusBarIcon);
    return;
  }
  updateStatusBarItem(
    profileStatusBarIcon,
    `${currentProfile.name}`,
    `SAS Profile: ${currentProfile.name}\n${currentProfile.profile["sas-endpoint"]}`
  );
}

function updateStatusBarItem(
  statusBarItem: StatusBarItem,
  text: string,
  tooltip: string
): void {
  statusBarItem.text = text;
  statusBarItem.tooltip = tooltip;
  statusBarItem.show();
}

function resetStatusBarItem(statusBarItem: StatusBarItem): void {
  statusBarItem.text = "No Active Profiles Found";
  statusBarItem.show();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
