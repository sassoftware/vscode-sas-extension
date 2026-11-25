import { expect } from "chai";
import * as sinon from "sinon";

import { RunResult } from "../../src/connection";
import { Session, onDidChangeSession } from "../../src/connection/session";

class MockSession extends Session {
  constructor(
    protected readonly connectionMock: () => void | Promise<void>,
    protected readonly closeMock: () => void = () => {},
  ) {
    super();
  }
  protected async establishConnection(): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
    await this.connectionMock();
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
  for (const silent of [true, false]) {
    it(`retries rejected setup (silent: ${silent})`, async () => {
      const failure = new Error("Connection failed");
      const connectionMock = sinon.stub();
      connectionMock.onFirstCall().rejects(failure);
      connectionMock.onSecondCall().resolves();
      const session = new MockSession(connectionMock);

      const error = await session.setup(silent).then(
        () => undefined,
        (error) => error,
      );
      expect(error).to.equal(failure);

      await session.setup(silent);
      expect(connectionMock.callCount).to.equal(2);
    });
  }

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
