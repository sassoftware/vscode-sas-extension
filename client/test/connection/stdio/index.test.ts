// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { expect } from "chai";
import * as childProcess from "child_process";
import { EventEmitter } from "events";
import * as sinon from "sinon";

import { StdioSession, getSession } from "../../../src/connection/stdio";
import { assertThrowsAsync } from "../../utils";

describe("stdio connection", () => {
  let sandbox: sinon.SinonSandbox;
  let session: StdioSession;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProcess: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox({
      useFakeTimers: { shouldClearNativeTimers: true },
    });

    const config = {
      saspath: "/path/to/sas",
      sasOptions: [],
    };

    session = new StdioSession(config);
    session.onExecutionLogFn = () => {
      return;
    };
  });

  afterEach(() => {
    sandbox.restore();
    if (sandbox.clock) {
      sandbox.clock.restore();
    }
  });

  describe("setup", () => {
    it("spawns SAS process with correct params", async () => {
      const config = {
        saspath: "/path/to/sas",
        sasOptions: ["-memsize", "2G"],
      };

      // Create mock streams
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStdin: any = new EventEmitter();
      mockStdin.write = sandbox.stub();
      mockStdin.end = sandbox.stub();

      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();

      // Create mock process
      mockProcess = new EventEmitter();
      mockProcess.stdin = mockStdin;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;
      mockProcess.kill = sandbox.stub();
      mockProcess.killed = false;

      // Stub child_process.spawn
      const spawnStub = sandbox
        .stub(childProcess, "spawn")
        .returns(mockProcess);

      session = new StdioSession(config);

      // Start setup in the background
      const setupPromise = session.setup();

      // Simulate SAS ready prompt
      process.nextTick(() => {
        mockStdout.emit("data", Buffer.from("?"));
      });

      await setupPromise;

      // Verify spawn was called correctly
      expect(spawnStub.calledOnce).to.be.true;
      const spawnArgs = spawnStub.firstCall.args;
      expect(spawnArgs[0]).to.equal("/path/to/sas");
      expect(spawnArgs[1]).to.include("-nodms");
      expect(spawnArgs[1]).to.include("-noterminal");
      expect(spawnArgs[1]).to.include("-memsize");
      expect(spawnArgs[1]).to.include("2G");
    });

    it("rejects on process error", async () => {
      const config = {
        saspath: "/path/to/sas",
        sasOptions: [],
      };

      // Create mock process that emits error
      mockProcess = new EventEmitter();
      mockProcess.stdin = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();

      sandbox.stub(childProcess, "spawn").returns(mockProcess);

      session = new StdioSession(config);

      const setupPromise = session.setup();

      // Simulate process error
      process.nextTick(() => {
        mockProcess.emit("error", new Error("SAS process failed to start"));
      });

      await assertThrowsAsync(async () => {
        await setupPromise;
      }, "SAS process failed to start");
    });

    it("rejects when process closes before ready", async () => {
      const config = {
        saspath: "/path/to/sas",
        sasOptions: [],
      };

      mockProcess = new EventEmitter();
      mockProcess.stdin = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.removeAllListeners = sandbox.stub();

      sandbox.stub(childProcess, "spawn").returns(mockProcess);

      session = new StdioSession(config);

      const setupPromise = session.setup();

      // Simulate process closing before ready
      process.nextTick(() => {
        mockProcess.stdout.removeAllListeners = sandbox.stub();
        mockProcess.stderr.removeAllListeners = sandbox.stub();
        mockProcess.emit("close", 1, null);
      });

      await assertThrowsAsync(async () => {
        await setupPromise;
      }, "Could not start the SAS process.");
    });
  });

  describe("run", () => {
    it("writes code to stdin and handles completion", async () => {
      const config = {
        saspath: "/path/to/sas",
        sasOptions: [],
      };

      // Create mock streams
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStdin: any = new EventEmitter();
      const writeStub = sandbox.stub();
      mockStdin.write = writeStub;
      mockStdin.end = sandbox.stub();

      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();

      mockProcess = new EventEmitter();
      mockProcess.stdin = mockStdin;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;
      mockProcess.kill = sandbox.stub();
      mockProcess.killed = false;

      sandbox.stub(childProcess, "spawn").returns(mockProcess);

      session = new StdioSession(config);

      // Setup session first
      const setupPromise = session.setup();
      process.nextTick(() => {
        mockStdout.emit("data", Buffer.from("?"));
      });
      await setupPromise;

      // Now run some code
      const runPromise = session.run("data test; x=1; run;");

      // Simulate completion marker
      process.nextTick(() => {
        mockStdout.emit("data", Buffer.from("quit82938829"));
      });

      await runPromise;

      // Verify code was written
      expect(writeStub.calledWith("data test; x=1; run;\n")).to.be.true;
      expect(writeStub.calledWith("%put quit82938829;\n")).to.be.true;
    });

    it("rejects if process is not running", async () => {
      const config = {
        saspath: "/path/to/sas",
        sasOptions: [],
      };

      session = new StdioSession(config);

      await assertThrowsAsync(async () => {
        await session.run("data test; x=1; run;");
      }, "SAS process is not running.");
    });
  });

  describe("close", () => {
    it("sends ENDSAS and closes stdin", async () => {
      const config = {
        saspath: "/path/to/sas",
        sasOptions: [],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStdin: any = new EventEmitter();
      const writeStub = sandbox.stub();
      const endStub = sandbox.stub();
      mockStdin.write = writeStub;
      mockStdin.end = endStub;

      const mockStdout = new EventEmitter();
      const mockStderr = new EventEmitter();

      mockProcess = new EventEmitter();
      mockProcess.stdin = mockStdin;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;
      mockProcess.kill = sandbox.stub();
      mockProcess.killed = false;
      mockProcess.removeAllListeners = sandbox.stub().returnsThis();
      mockStdout.removeAllListeners = sandbox.stub().returnsThis();
      mockStderr.removeAllListeners = sandbox.stub().returnsThis();

      sandbox.stub(childProcess, "spawn").returns(mockProcess);

      session = new StdioSession(config);

      // Setup session
      const setupPromise = session.setup();
      process.nextTick(() => {
        mockStdout.emit("data", Buffer.from("?"));
      });
      await setupPromise;

      // Close session
      session.close();

      // Verify ENDSAS was written
      expect(writeStub.calledWith("endsas;\n")).to.be.true;
      expect(endStub.calledOnce).to.be.true;
    });
  });

  describe("getSession", () => {
    it("returns singleton session instance", () => {
      const config = {
        saspath: "/path/to/sas",
        sasOptions: [],
      };

      const session1 = getSession(config);
      const session2 = getSession(config);

      expect(session1).to.equal(session2);
    });
  });
});
