// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import * as path from "path";
import { commands, ExtensionContext, languages, StatusBarAlignment, StatusBarItem, window, workspace } from "vscode";
import { run } from "../commands/run";
import { closeSession } from "../commands/closeSession";
import { create as activeProfileTrackerCreate } from '../components/profilemanager/active-profile-tracker';
import { ProfileConfig } from "../viya/profile";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { LogTokensProvider, legend } from "../LogViewer";
import os from 'os';

//const config = workspace.getConfiguration("SAS.session");

//Get configuration file from settings
// const configFile: string = config.get("configFile");
// const profileConfig = new ProfileConfig(configFile ? configFile : path.join(os.homedir(), '.sas', 'vs-config.json'), function () { return {}; });

const profileConfig = new ProfileConfig(path.join(os.homedir(), '.sas', 'vs-config.json'), function () { return {}; });
const activeProfileTracker = activeProfileTrackerCreate(profileConfig);

let client: LanguageClient;

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

  // Create Profile status bar item
  const activeProfileStatusBarIcon = window.createStatusBarItem(StatusBarAlignment.Left, 0);
  activeProfileStatusBarIcon.command = 'SAS.session.switchProfile';

  // Start the client. This will also launch the server
  client.start();

  context.subscriptions.push(
    commands.registerCommand("SAS.session.run", run),
    commands.registerCommand("SAS.session.close", closeSession),
    commands.registerCommand("SAS.session.switchProfile", switchProfile),
    languages.registerDocumentSemanticTokensProvider(
      { language: "sas-log" },
      LogTokensProvider,
      legend
    ),
    activeProfileStatusBarIcon
  );

  profileConfig.getActiveProfile().then(function(currentProfile) {
    updateStatusBarItem(activeProfileStatusBarIcon, `${currentProfile.name}`, `SAS Profile: ${currentProfile.name}\n${currentProfile.profile['sas-endpoint']}`, true);
  });

  activeProfileTracker.activeChanged(async () => {
    const currentProfile = await profileConfig.getActiveProfile();
    if (!currentProfile) { return; }
    updateStatusBarItem(activeProfileStatusBarIcon, `${currentProfile.name}`, `SAS Profile: ${currentProfile.name}\n${currentProfile.profile['sas-endpoint']}`, true);
  });
}

function updateStatusBarItem(statusBarItem: StatusBarItem, text: string, tooltip: string, show: boolean): void {
  statusBarItem.text = text;
  statusBarItem.tooltip = tooltip;
  if (show) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

async function switchProfile() {
  profileConfig.listProfile().then( async function(list){
    const selected = await window.showQuickPick(
      list,
      { placeHolder: 'Select SAS profile' }
    );
    if (selected) {
      setProfile(selected);
    }
  });
}

async function setProfile(targetProfile: string) {
  await profileConfig.setActiveProfile(targetProfile).then( () => activeProfileTracker.setActive(targetProfile));
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
