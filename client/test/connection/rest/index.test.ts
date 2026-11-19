// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { expect } from "chai";
import { SinonSandbox, createSandbox } from "sinon";

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
});
