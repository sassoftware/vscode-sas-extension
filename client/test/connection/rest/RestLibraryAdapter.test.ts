// Copyright © 2026, SAS Institute Inc. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { expect } from "chai";
import * as sinon from "sinon";

import type { RunResult } from "../../../src/connection";
import RestLibraryAdapter from "../../../src/connection/rest/RestLibraryAdapter";
import { Session } from "../../../src/connection/session";

const item = { name: "AIR", library: "SASHELP" };

class TestSession extends Session {
  public readonly close = sinon.stub().resolves();

  protected async establishConnection(): Promise<void> {}

  protected _run(): Promise<RunResult> {
    throw new Error("Not implemented");
  }

  protected _close(): void {}

  public sessionId(): string | undefined {
    return undefined;
  }
}

class TestAdapter extends RestLibraryAdapter {
  public connections = 0;
  private readonly request: (sessionId: string) => Promise<unknown>;
  public readonly session = new TestSession();

  public constructor(request: (sessionId: string) => Promise<unknown>) {
    super();
    this.request = request;
    this.sessionId = "stale-session";
    this.dataAccessApi = {
      getRows: async ({ sessionId }) => ({
        data: await this.request(sessionId),
      }),
    } as never;
  }

  protected getSession() {
    return this.session;
  }

  public async connect(): Promise<void> {
    this.connections += 1;
    expect(this.sessionId).to.equal(undefined);
    this.sessionId = "replacement-session";
    this.dataAccessApi = {
      getRows: async ({ sessionId }) => ({
        data: await this.request(sessionId),
      }),
    } as never;
  }
}

describe("RestLibraryAdapter session recovery", () => {
  it("shares recovery and retries concurrent requests with the replacement session", async () => {
    const requestedSessionIds: string[] = [];
    let staleRequests = 0;
    const adapter = new TestAdapter(async (sessionId) => {
      requestedSessionIds.push(sessionId);
      if (sessionId === "stale-session" && staleRequests++ < 2) {
        const error = new Error("session not found") as Error & {
          response?: { status: number };
        };
        error.response = { status: 404 };
        throw error;
      }
      return { items: [], count: 0 };
    });

    const results = await Promise.all([
      adapter.getRows(item, 0, 10, [], undefined),
      adapter.getRows(item, 0, 10, [], undefined),
    ]);

    expect(results).to.have.length(2);
    expect(adapter.connections).to.equal(1);
    expect(adapter.session.close.calledOnceWithExactly(false)).to.equal(true);
    expect(requestedSessionIds).to.deep.equal([
      "stale-session",
      "stale-session",
      "replacement-session",
      "replacement-session",
    ]);
  });
});
