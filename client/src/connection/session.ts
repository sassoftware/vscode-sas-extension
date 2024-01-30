// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
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

  abstract setup(): Promise<void>;
  abstract run(code: string): Promise<RunResult>;
  cancel?(): Promise<void>;
  abstract close(): Promise<void> | void;
  abstract sessionId?(): string | undefined;
}
