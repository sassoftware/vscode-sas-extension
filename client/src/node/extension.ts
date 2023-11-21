// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ConfigurationChangeEvent,
  ExtensionContext,
  NotebookCellData,
  NotebookCellKind,
  NotebookData,
  StatusBarAlignment,
  StatusBarItem,
  Uri,
  authentication,
  commands,
  l10n,
  languages,
  tasks,
  window,
  workspace,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import * as path from "path";

import { checkProfileAndAuthorize } from "../commands/authorize";
import { closeSession } from "../commands/closeSession";
import {
  addProfile,
  deleteProfile,
  profileConfig,
  switchProfile,
  updateProfile,
} from "../commands/profile";
import { run, runRegion, runSelected } from "../commands/run";
import { SASAuthProvider } from "../components/AuthProvider";
import { installCAs } from "../components/CAHelper";
import ContentNavigator from "../components/ContentNavigator";
import { setContext } from "../components/ExtensionContext";
import LibraryNavigator from "../components/LibraryNavigator";
import { LogTokensProvider, legend } from "../components/LogViewer";
import ResultPanelSubscriptionProvider from "../components/ResultPanel";
import { NotebookController } from "../components/notebook/Controller";
import { NotebookSerializer } from "../components/notebook/Serializer";
import { ConnectionType } from "../components/profile";
import { SasTaskProvider } from "../components/tasks/SasTaskProvider";
import { SAS_TASK_TYPE } from "../components/tasks/SasTasks";
import { getSelectedRegions } from "../utils/utils";

let client: LanguageClient;
// Create Profile status bar item
const activeProfileStatusBarIcon = window.createStatusBarItem(
  StatusBarAlignment.Left,
  0,
);

export function activate(context: ExtensionContext): void {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "dist", "node", "server.js"),
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
    clientOptions,
  );

  activeProfileStatusBarIcon.command = "SAS.switchProfile";

  // Start the client. This will also launch the server
  client.start();

  installCAs();

  setContext(context);

  const libraryNavigator = new LibraryNavigator(context);
  const contentNavigator = new ContentNavigator(context);
  const resultPanelSubscriptionProvider = new ResultPanelSubscriptionProvider();

  context.subscriptions.push(
    commands.registerCommand("SAS.run", async () => {
      await run();
      await libraryNavigator.refresh();
    }),
    commands.registerCommand("SAS.runSelected", async (uri: Uri) => {
      await runSelected(uri);
      await libraryNavigator.refresh();
    }),
    commands.registerCommand("SAS.runRegion", async () => {
      await runRegion(client);
      await libraryNavigator.refresh();
    }),
    commands.registerCommand("SAS.close", (silent) => {
      closeSession(
        silent === true ? undefined : l10n.t("The SAS session has closed."),
      );
    }),
    commands.registerCommand("SAS.switchProfile", switchProfile),
    commands.registerCommand("SAS.addProfile", addProfile),
    commands.registerCommand("SAS.deleteProfile", deleteProfile),
    commands.registerCommand("SAS.updateProfile", updateProfile),
    commands.registerCommand("SAS.authorize", checkProfileAndAuthorize),
    authentication.registerAuthenticationProvider(
      SASAuthProvider.id,
      "SAS",
      new SASAuthProvider(context.secrets),
    ),

    languages.registerDocumentSemanticTokensProvider(
      { language: "sas-log" },
      LogTokensProvider,
      legend,
    ),
    activeProfileStatusBarIcon,
    ...libraryNavigator.getSubscriptions(),
    ...contentNavigator.getSubscriptions(),
    ...resultPanelSubscriptionProvider.getSubscriptions(),
    // If configFile setting is changed, update watcher to watch new configuration file
    workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (event.affectsConfiguration("SAS.connectionProfiles")) {
        triggerProfileUpdate();
      }
    }),
    workspace.registerNotebookSerializer(
      "sas-notebook",
      new NotebookSerializer(),
    ),
    window.onDidChangeTextEditorSelection(async () => {
      const selections = await getSelectedRegions(client);
      if (selections.length === 0) {
        commands.executeCommand("setContext", "SAS.running", true);
      } else {
        commands.executeCommand("setContext", "SAS.running", false);
      }
    }),
    new NotebookController(),
    commands.registerCommand("SAS.notebook.new", async () => {
      await window.showNotebookDocument(
        await workspace.openNotebookDocument(
          "sas-notebook",
          new NotebookData([
            new NotebookCellData(NotebookCellKind.Code, "", "sas"),
          ]),
        ),
      );
    }),
    tasks.registerTaskProvider(SAS_TASK_TYPE, new SasTaskProvider()),
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

    const connectionType =
      profileList[activeProfileName].connectionType || ConnectionType.Rest;

    //Set the connection type
    commands.executeCommand("setContext", "SAS.connectionType", connectionType);

    //See if the connection is direct (ie. serverId)
    commands.executeCommand(
      "setContext",
      "SAS.connection.direct",
      connectionType === ConnectionType.Rest &&
        "serverId" in profileList[activeProfileName],
    );
  } else {
    profileConfig.updateActiveProfileSetting("");
    commands.executeCommand(
      "setContext",
      "SAS.connectionType",
      ConnectionType.Rest,
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
      `${activeProfileName}\n${statusBarTooltip}`,
    );
  }
}

function updateStatusBarItem(
  statusBarItem: StatusBarItem,
  text: string,
  tooltip: string,
): void {
  statusBarItem.text = `$(account) ${text}`;
  statusBarItem.tooltip = tooltip;
  statusBarItem.show();
}

function resetStatusBarItem(statusBarItem: StatusBarItem): void {
  statusBarItem.text = `$(debug-disconnect) ${l10n.t("No Profile")}`;
  statusBarItem.tooltip = l10n.t("No SAS Connection Profile");
  statusBarItem.show();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
