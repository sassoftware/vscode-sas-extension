// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import * as path from "path";
import {
  authentication,
  commands,
  ConfigurationChangeEvent,
  ExtensionContext,
  languages,
  StatusBarAlignment,
  StatusBarItem,
  window,
  workspace,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { closeSession } from "../commands/closeSession";
import {
  addProfile,
  deleteProfile,
  profileConfig,
  switchProfile,
  updateProfile,
} from "../commands/profile";
import { run, runSelected } from "../commands/run";
import { SASAuthProvider } from "../components/AuthProvider";
import { legend, LogTokensProvider } from "../components/LogViewer";
import SASContentProvider from "../components/SASContentProvider";

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

  activeProfileStatusBarIcon.command = "SAS.switchProfile";

  // Start the client. This will also launch the server
  client.start();

  window.registerTreeDataProvider("sas-content", new SASContentProvider());

  context.subscriptions.push(
    commands.registerCommand("SAS.run", run),
    commands.registerCommand("SAS.runSelected", runSelected),
    commands.registerCommand("SAS.close", (silent) => {
      closeSession(silent === true ? undefined : "The SAS session has closed.");
      commands.executeCommand("setContext", "SAS.authenticated", false);
    }),
    commands.registerCommand("SAS.switchProfile", switchProfile),
    commands.registerCommand("SAS.addProfile", addProfile),
    commands.registerCommand("SAS.deleteProfile", deleteProfile),
    commands.registerCommand("SAS.updateProfile", updateProfile),
    authentication.registerAuthenticationProvider(
      SASAuthProvider.id,
      "SAS",
      new SASAuthProvider(context.secrets)
    ),
    languages.registerDocumentSemanticTokensProvider(
      { language: "sas-log" },
      LogTokensProvider,
      legend
    ),
    activeProfileStatusBarIcon
  );

  // Reset first to set "No Active Profiles"
  resetStatusBarItem(activeProfileStatusBarIcon);
  // Update status bar if profile is found
  updateStatusBarProfile(activeProfileStatusBarIcon);

  // If configFile setting is changed, update watcher to watch new configuration file
  workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
    if (event.affectsConfiguration("SAS.connectionProfiles")) {
      const profileList = profileConfig.getAllProfiles();
      const activeProfileName = profileConfig.getActiveProfile();
      if (activeProfileName in profileList || activeProfileName === "") {
        updateStatusBarProfile(activeProfileStatusBarIcon);
      } else {
        profileConfig.updateActiveProfileSetting("");
      }
    }
  });
}

async function updateStatusBarProfile(profileStatusBarIcon: StatusBarItem) {
  const activeProfileName = profileConfig.getActiveProfile();
  const activeProfile = profileConfig.getProfileByName(activeProfileName);
  if (!activeProfile) {
    resetStatusBarItem(profileStatusBarIcon);
  } else {
    updateStatusBarItem(
      profileStatusBarIcon,
      `${activeProfileName}`,
      `${activeProfileName}\n${activeProfile.endpoint}`
    );
  }
}

function updateStatusBarItem(
  statusBarItem: StatusBarItem,
  text: string,
  tooltip: string
): void {
  statusBarItem.text = `$(account) ${text}`;
  statusBarItem.tooltip = tooltip;
  statusBarItem.show();
}

function resetStatusBarItem(statusBarItem: StatusBarItem): void {
  statusBarItem.text = "$(debug-disconnect) No Profile";
  statusBarItem.tooltip = "No SAS Connection Profile";
  statusBarItem.show();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  closeSession();
  return client.stop();
}
