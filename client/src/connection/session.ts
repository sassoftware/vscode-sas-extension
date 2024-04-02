// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, l10n, window } from "vscode";

import { OnLogFn, RunResult } from ".";

export abstract class Session {
  protected _onSessionLogFn: OnLogFn | undefined;
  public set onSessionLogFn(value: OnLogFn) {
    this._onSessionLogFn = value;
  }

  protected _onExecutionLogFn: OnLogFn | undefined;
  public set onExecutionLogFn(value: OnLogFn) {
    this._onExecutionLogFn = value;
  }

  async setup(silent?: boolean): Promise<void> {
    if (silent) {
      return await this.establishConnection();
    }

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t("Connecting to SAS session..."),
      },
      this.establishConnection,
    );
  }

  protected abstract establishConnection(): Promise<void>;
  abstract run(code: string): Promise<RunResult>;
  cancel?(): Promise<void>;
  abstract close(): Promise<void> | void;
  abstract sessionId?(): string | undefined;
}
