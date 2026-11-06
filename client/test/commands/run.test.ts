import * as vscode from "vscode";

import * as assert from "assert";
import sinon from "sinon";

import { profileConfig } from "../../src/commands/profile";
import { run } from "../../src/commands/run";
import { sasDiagnostic } from "../../src/components/logViewer/sasDiagnostics";
import { ConnectionType, Profile } from "../../src/components/profile";
import * as connection from "../../src/connection";
import { Session } from "../../src/connection/session";

class MockSession extends Session {
  async setup(): Promise<void> {}

  protected async establishConnection(): Promise<void> {}

  protected async _run(): Promise<connection.RunResult> {
    return {};
  }

  protected _close(): void {}

  sessionId(): string | undefined {
    return undefined;
  }
}

describe("run - SAS Server and Libraries", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    const code = "data test; run;";
    const uri = vscode.Uri.file("/test/SampleCode.sas");

    // Mock the editor instead of opening a real SAS document.
    sandbox.stub(vscode.window, "activeTextEditor").value({
      document: {
        uri,
        fileName: uri.fsPath,
        languageId: "sas",
        lineCount: 1,
        getText: () => code,
        lineAt: () => ({ text: code }),
      },
      selections: [],
    });

    // Avoid creating diagnostic subscriptions during the test.
    sandbox.stub(sasDiagnostic, "generateLogFn").returns(() => {});
  });

  afterEach(() => {
    sandbox.restore();
  });

  for (const connectionType of [ConnectionType.IOM, ConnectionType.COM]) {
    it(`connects and displays SAS Server and Libraries for ${connectionType}`, async () => {
      const session = new MockSession();
      let connected = false;

      const setupStub = sandbox.stub(session, "setup").callsFake(async () => {
        connected = true;
      });

      const runStub = sandbox.spy(session, "run");

      sandbox.stub(connection, "getSession").returns(session);

      sandbox.stub(profileConfig, "getActiveProfile").returns("test-profile");

      const profile: Profile =
        connectionType === ConnectionType.IOM
          ? {
              connectionType: ConnectionType.IOM,
              host: "localhost",
              username: "test",
              port: 8591,
            }
          : {
              connectionType: ConnectionType.COM,
              host: "localhost",
            };

      sandbox.stub(profileConfig, "getProfileByName").returns(profile);

      sandbox.stub(profileConfig, "getActiveProfileDetail").returns({
        name: "test-profile",
        profile,
      });

      const commandSpy = sandbox.spy(vscode.commands, "executeCommand");

      // Initially disconnected.
      assert.strictEqual(connected, false);

      // Run SAS program.
      await run();

      // Session should now be connected.
      assert.strictEqual(connected, true);
      sinon.assert.calledOnce(setupStub);

      // Program should execute.
      sinon.assert.calledOnce(runStub);

      // Libraries should be displayed.
      sinon.assert.calledWith(
        commandSpy,
        "setContext",
        "SAS.librariesDisplayed",
        true,
      );

      // SAS Server should be displayed.
      sinon.assert.calledWith(
        commandSpy,
        "setContext",
        "SAS.serverDisplayed",
        true,
      );
    });
  }
});
