import { expect } from "chai";
import * as sinon from "sinon";

import { RunResult } from "../../src/connection";
import { Session } from "../../src/connection/session";

class MockSession extends Session {
  constructor(protected readonly connectionMock: () => void) {
    super();
  }
  protected async establishConnection(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.connectionMock();
        resolve();
      }, 100);
    });
  }
  protected _run(code: string, ...args: any[]): Promise<RunResult> {
    throw new Error("Method not implemented.");
  }
  protected _close(): Promise<void> | void {}
  sessionId?(): string | undefined {
    return;
  }
}

describe.only("Session test", () => {
  it("triggers establish connection only once", async () => {
    const mockConnectionFn = sinon.mock();
    const mockSession = new MockSession(mockConnectionFn);
    const setupPromises: Promise<void>[] = Array(10)
      .fill(true)
      .map(() => mockSession.setup());

    // Wait for everything to wrap up
    await Promise.all(setupPromises);

    // We called setup 10 times, but we expect to have only called establishConnection
    // once.
    expect(mockConnectionFn.callCount).to.equal(1);
  });
});
