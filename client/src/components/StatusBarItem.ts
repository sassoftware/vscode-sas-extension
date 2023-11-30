// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { MarkdownString, StatusBarAlignment, Uri, l10n, window } from "vscode";

import { profileConfig } from "../commands/profile";

const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
statusBarItem.command = "SAS.switchProfile";

export const getStatusBarItem = () => statusBarItem;

export async function updateStatusBarItem(connected?: boolean) {
  const activeProfileName = profileConfig.getActiveProfile();
  const activeProfile = profileConfig.getProfileByName(activeProfileName);
  if (!activeProfile) {
    resetStatusBarItem();
  } else {
    const targetURL = profileConfig.remoteTarget(activeProfileName);
    const closeSessionUri = Uri.parse("command:SAS.close");
    const tooltip = new MarkdownString(
      `#### ${l10n.t("SAS Profile")}\n\n${activeProfileName}\n\n${targetURL}${
        connected
          ? `\n\n---\n\n[${l10n.t("Close Session")}](${closeSessionUri})`
          : ""
      }`,
    );
    tooltip.isTrusted = true;

    statusBarItem.text = `${
      connected ? "$(vm-active)" : "$(account)"
    } ${activeProfileName}`;
    statusBarItem.tooltip = tooltip;
    statusBarItem.show();
  }
}

export function resetStatusBarItem(): void {
  statusBarItem.text = `$(debug-disconnect) ${l10n.t("No Profile")}`;
  statusBarItem.tooltip = l10n.t("No SAS Connection Profile");
  statusBarItem.show();
}
