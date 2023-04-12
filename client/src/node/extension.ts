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
import { checkProfileAndAuthorize } from "../commands/authorize";
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
import ContentNavigator from "../components/ContentNavigator";
import LibraryNavigator from "../components/LibraryNavigator";
import { legend, LogTokensProvider } from "../components/LogViewer";
import { ConnectionType } from "../components/profile";

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

  const libraryNavigator = new LibraryNavigator(context);
  const contentNavigator = new ContentNavigator(context);

  context.subscriptions.push(
    commands.registerCommand("SAS.run", async () => {
      await run();
      await libraryNavigator.refresh();
    }),
    commands.registerCommand("SAS.runSelected", async () => {
      await runSelected();
      await libraryNavigator.refresh();
    }),
    commands.registerCommand("SAS.close", (silent) => {
      closeSession(silent === true ? undefined : "The SAS session has closed.");
    }),
    commands.registerCommand("SAS.switchProfile", switchProfile),
    commands.registerCommand("SAS.addProfile", addProfile),
    commands.registerCommand("SAS.deleteProfile", deleteProfile),
    commands.registerCommand("SAS.updateProfile", updateProfile),
    commands.registerCommand("SAS.authorize", checkProfileAndAuthorize),
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
    activeProfileStatusBarIcon,
    ...libraryNavigator.getSubscriptions(),
    ...contentNavigator.getSubscriptions(),
    // If configFile setting is changed, update watcher to watch new configuration file
    workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (event.affectsConfiguration("SAS.connectionProfiles")) {
        triggerProfileUpdate();
      }
    })
  );

  // Reset first to set "No Active Profiles"
  resetStatusBarItem(activeProfileStatusBarIcon);
  // Update status bar if profile is found
  updateStatusBarProfile(activeProfileStatusBarIcon);

  profileConfig.migrateLegacyProfiles();
  triggerProfileUpdate();
}

function triggerProfileUpdate(): void {
  const profileList = profileConfig.getAllProfiles();
  const activeProfileName = profileConfig.getActiveProfile();
  if (profileList[activeProfileName]) {
    updateStatusBarProfile(activeProfileStatusBarIcon);
    commands.executeCommand(
      "setContext",
      "SAS.connectionType",
      profileList[activeProfileName]?.connectionType || ConnectionType.Rest
    );
  } else {
    profileConfig.updateActiveProfileSetting("");
    commands.executeCommand(
      "setContext",
      "SAS.connectionType",
      ConnectionType.Rest
    );
  }
}

async function updateStatusBarProfile(profileStatusBarIcon: StatusBarItem) {
  const activeProfileName = profileConfig.getActiveProfile();
  const activeProfile = profileConfig.getProfileByName(activeProfileName);
  if (!activeProfile) {
    resetStatusBarItem(profileStatusBarIcon);
  } else {
    const statusBarTooltip = profileConfig.remoteTarget(activeProfileName);

    updateStatusBarItem(
      profileStatusBarIcon,
      `${activeProfileName}`,
      `${activeProfileName}\n${statusBarTooltip}`
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
