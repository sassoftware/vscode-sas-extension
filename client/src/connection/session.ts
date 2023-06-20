import { LogLine, OnLogFn, RunResult } from ".";

export class BaseSession {
  _onLogFn: OnLogFn;
  public set onLogFn(value: (logs: LogLine[]) => void) {
    this._onLogFn = value;
  }
}

export interface Session {
  onLogFn: (logs: LogLine[]) => void;
  setup(): Promise<void>;
  run(code: string, onLog?: (logs: LogLine[]) => void): Promise<RunResult>;
  cancel?(): Promise<void>;
  close(): Promise<void> | void;
  sessionId?(): string | undefined;
}
