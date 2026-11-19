// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { AxiosError } from "axios";
import { expect } from "chai";
import { SinonSandbox, createSandbox } from "sinon";

import * as extensionContext from "../../../src/components/ExtensionContext";
import { getSession } from "../../../src/connection/rest";
import { ComputeServer } from "../../../src/connection/rest/server";
import { ComputeSession } from "../../../src/connection/rest/session";
import { onDidChangeSession } from "../../../src/connection/session";

describe("REST connection", () => {
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("setup", () => {
    it("notifies session change when a new session is created", async () => {
      const computeSession = new ComputeSession("test-session");

      sandbox
        .stub(computeSession, "getLogStream")
        .callsFake(async function* () {
          yield [];
        });

      sandbox.stub(computeSession, "delete").resolves();

      sandbox
        .stub(ComputeServer.prototype, "getSession")
        .resolves(computeSession);

      const sessionChanged = sandbox.spy();
      const subscription = onDidChangeSession(sessionChanged);

      const session = getSession({
        endpoint: "http://example.test",
        serverId: "test-server",
        reconnect: false,
      });

      await session.setup(true);

      expect(sessionChanged.calledOnce).to.equal(true);

      subscription.dispose();

      await session.close();
    });
  });

  for (const operation of ["setup state", "setup cancel", "run"]) {
    it(`replaces the session after ${operation} returns error 5113`, async () => {
      let persistedId: string | undefined;
      sandbox
        .stub(extensionContext, "setContextValue")
        .callsFake(async (_key, value) => {
          persistedId = value;
        });
      sandbox
        .stub(extensionContext, "getContextValue")
        .callsFake(async () => persistedId);

      const failedSession = new ComputeSession("failed-session");
      const replacement = new ComputeSession("replacement-session");
      for (const computeSession of [failedSession, replacement]) {
        sandbox
          .stub(computeSession, "getLogStream")
          .callsFake(async function* () {
            yield [];
          });
      }
      const deletion = sandbox
        .stub(failedSession, "delete")
        .rejects(new Error("Session already stopped"));
      sandbox.stub(replacement, "delete").resolves();
      const failure = Object.assign(new AxiosError("Session stopped"), {
        response: { data: { errorCode: 5113 } },
      });
      const getState = sandbox.stub(failedSession, "getState");
      if (operation === "setup state") {
        getState.rejects(failure);
      } else {
        getState.resolves("failed");
      }
      sandbox.stub(failedSession, "cancel").rejects(failure);
      sandbox.stub(failedSession, "execute").rejects(failure);
      const createSession = sandbox.stub(ComputeServer.prototype, "getSession");
      createSession.onFirstCall().resolves(failedSession);
      createSession.onSecondCall().resolves(replacement);

      const session = getSession({
        endpoint: "http://example.test",
        serverId: "test-server",
        reconnect: true,
      });
      try {
        await session.setup(true);
        expect(persistedId).to.equal("failed-session");

        const request =
          operation === "run"
            ? session.run("abort abend;")
            : session.setup(true);
        const error = await request.then(
          () => undefined,
          (error) => error,
        );
        expect(error).to.equal(failure);
        expect(session.sessionId()).to.equal(undefined);
        expect(persistedId).to.equal(undefined);
        expect(deletion.calledOnce).to.equal(true);

        await session.setup(true);
        expect(session.sessionId()).to.equal("replacement-session");
        expect(persistedId).to.equal("replacement-session");
        expect(createSession.callCount).to.equal(2);
        expect(createSession.secondCall.args).to.deep.equal([]);
      } finally {
        await session.close();
      }
    });
  }
});
