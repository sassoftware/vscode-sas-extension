// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { ProgressLocation, window, commands } from "vscode";
import { getSession } from "../connection";
import { profileConfig, switchProfile } from "./profile";

let running = false;

async function _authorize() {
  if (running) {
    return;
  }
  if (profileConfig.getActiveProfile() === "") {
    switchProfile();
    return;
  }
  running = true;
  const session = getSession();

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Connecting to SAS session...",
    },
    session.setup
  );
  commands.executeCommand("setContext", "SAS.authorized", true);
}
export function authorize(): void {
  _authorize();
}
