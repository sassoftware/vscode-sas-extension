// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, l10n, window } from "vscode";

import RestLibraryAdapter from "../../connection/rest/RestLibraryAdapter";
import { ConnectionType } from "../profile";
import { LibraryAdapter } from "./types";

class LibraryAdapterFactory {
  public create(connectionType: ConnectionType): LibraryAdapter {
    switch (connectionType) {
      case ConnectionType.Rest:
      default:
        return new RestLibraryAdapter(this.emitConnectionNotification);
    }
  }

  private async emitConnectionNotification(
    callback: () => Promise<void>,
  ): Promise<void> {
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t("Connecting to SAS session..."),
      },
      callback,
    );
  }
}

export default LibraryAdapterFactory;
