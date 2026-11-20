import { expect } from "chai";
import * as sinon from "sinon";

import { RunResult } from "../../src/connection";
import { Session, onDidChangeSession } from "../../src/connection/session";

class MockSession extends Session {
  constructor(
    protected readonly connectionMock: () => void,
    protected readonly closeMock: () => void = () => {},
  ) {
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

  protected _close(): Promise<void> | void {
    this.closeMock();
  }

  sessionId?(): string | undefined {
    return;
  }
}

describe("Session test", () => {
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

  it("notifies session change when session closes", () => {
    const sessionChanged = sinon.spy();
    const closeMock = sinon.spy();
    const subscription = onDidChangeSession(sessionChanged);

    const mockSession = new MockSession(() => {}, closeMock);

    mockSession.close();

    expect(sessionChanged.calledOnce).to.equal(true);
    expect(closeMock.calledOnce).to.equal(true);

    subscription.dispose();
  });
});
