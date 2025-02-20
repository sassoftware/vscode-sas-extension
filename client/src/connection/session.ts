// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, l10n, window } from "vscode";

import type { OnLogFn, RunResult } from ".";

export abstract class Session {
  protected _rejectRun: (reason?: unknown) => void | undefined;

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

  run(code: string, ...args): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      this._rejectRun = reject;
      this._run(code, ...args)
        .then(resolve, reject)
        .finally(() => (this._rejectRun = undefined));
    });
  }
  protected abstract _run(code: string, ...args): Promise<RunResult>;

  cancel?(): Promise<void>;

  close(): Promise<void> | void {
    if (this._rejectRun) {
      this._rejectRun({ message: l10n.t("The SAS session has closed.") });
      this._rejectRun = undefined;
    }
    return this._close();
  }
  protected abstract _close(): Promise<void> | void;

  abstract sessionId?(): string | undefined;
}
