// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { LogLine, OnLogFn, RunResult } from ".";

export abstract class Session {
  protected _onLogFn: OnLogFn;
  public set onLogFn(value: (logs: LogLine[]) => void) {
    this._onLogFn = value;
  }

  abstract setup(): Promise<void>;
  abstract run(
    code: string,
    onLog?: (logs: LogLine[]) => void
  ): Promise<RunResult>;
  abstract cancel?(): Promise<void>;
  abstract close(): Promise<void> | void;
  abstract sessionId?(): string | undefined;
}
