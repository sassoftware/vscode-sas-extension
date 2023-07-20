// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OnLogFn, RunResult } from ".";

export abstract class Session {
  protected _onLogFn: OnLogFn | undefined;
  public set onLogFn(value: OnLogFn) {
    this._onLogFn = value;
  }

  abstract setup(): Promise<void>;
  abstract run(code: string): Promise<RunResult>;
  abstract cancel?(): Promise<void>;
  abstract close(): Promise<void> | void;
  abstract sessionId?(): string | undefined;
}
