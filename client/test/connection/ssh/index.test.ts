import * as sinon from "sinon";
import { Client, ClientChannel } from "ssh2";
import * as fs from "fs";
import { SSHSession } from "../../../src/connection/ssh";
import { assertThrowsAsync, getTestFixtureContent } from "../../utils";
import { assert, expect } from "chai";
import { StubbedInstance, stubInterface } from "ts-sinon";

describe("ssh connection", () => {
  const seconds = 1000;
  let keyContent: string;
  let sandbox: sinon.SinonSandbox;
  let session: SSHSession;
  let streamOnStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox({
      useFakeTimers: { shouldClearNativeTimers: true },
    });
    sandbox.clock;

    const config = {
      host: "host",
      username: "username",
      port: 22,
      saspath: "/path/to/sas_u8",
      sasOptions: [],
      privateKeyPath: "/path/to/key",
    };

    session = new SSHSession(config);

    keyContent = getTestFixtureContent("keyContent.txt").toString();
    sandbox.stub(fs, "readFileSync").returns(keyContent);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.clock.restore();
  });

  describe("setup", () => {
    it("calls connect with correct params", async () => {
      const config = {
        host: "host",
        username: "username",
        port: 22,
        saspath: "/path/to/sas_u8",
        sasOptions: [],
        privateKeyPath: "../../testFixture/keyContent.txt",
      };

      sandbox.stub(Client.prototype, "connect").callsFake(function () {
        this.emit("ready");
        return undefined;
      });

      sandbox.stub(Client.prototype, "shell").callsArgWithAsync(0, null, {
        on: (streamOnStub = sandbox.stub()),
        write: sandbox.stub(),
      });

      sandbox.stub(Client.prototype, "end");

      const sshStreamCloseStub = sandbox.stub();
      streamOnStub.withArgs("close").callsArgWithAsync(1).returns({
        close: sshStreamCloseStub,
      });

      session = new SSHSession(config);

      streamOnStub.callsFake((event, callback) => {
        if (event === "data") {
          //simulate a question mark to resolve the promise
          callback("?");
        }
      });

      await session.setup();
    });

    it("rejects on connection error", async () => {
      const config = {
        host: "host",
        username: "username",
        port: 22,
        saspath: "/path/to/sas_u8",
        sasOptions: [],
        privateKeyPath: "/path/to/key",
      };

      sandbox.stub(Client.prototype, "connect").callsFake(function () {
        this.emit("error", new Error("SSH Connection Failed"));
        return undefined;
      });

      session = new SSHSession(config);
      await assertThrowsAsync(async () => {
        await session.setup();
      }, "SSH Connection Failed");
    });

    it("rejects on shell error", async () => {
      const config = {
        host: "host",
        username: "username",
        port: 22,
        saspath: "/path/to/sas_u8",
        sasOptions: [],
        privateKeyPath: "/path/to/key",
      };

      sandbox.stub(Client.prototype, "connect").callsFake(function () {
        this.emit("ready");
        return undefined;
      });

      sandbox.stub(Client.prototype, "shell").callsFake((cb) => {
        cb(new Error("Shell Connection Failed"), null);
        return this;
      });

      session = new SSHSession(config);

      await assertThrowsAsync(async () => {
        await session.setup();
      }, "Shell Connection Failed");
    });

    it("rejects on ready timeout", async () => {
      const config = {
        host: "host",
        username: "username",
        port: 22,
        saspath: "/path/to/sas_u8",
        sasOptions: [],
        privateKeyPath: "/path/to/key",
      };

      sandbox.stub(Client.prototype, "connect").callsFake(function () {
        sandbox.clock.tick(50 * seconds);
        this.emit("ready");
        return undefined;
      });

      session = new SSHSession(config);
      await assertThrowsAsync(async () => {
        await session.setup();
      }, "Failed to connect to Session. Check profile settings");
    });
  });

  describe("run", () => {
    let streamStub: StubbedInstance<ClientChannel>;
    let onDataListener;

    const config = {
      host: "host",
      username: "username",
      port: 22,
      saspath: "/path/to/sas_u8",
      sasOptions: [],
      privateKeyPath: "../../testFixture/keyContent.txt",
    };

    const session = new SSHSession(config);

    beforeEach(() => {
      streamStub = stubInterface<ClientChannel>();
      sandbox.stub(Client.prototype, "connect").callsFake(function () {
        this.emit("ready");
        return undefined;
      });

      sandbox.stub(Client.prototype, "shell").callsFake((callback) => {
        callback(null, streamStub);
        return this;
      });

      streamStub.on.callsFake((event, callback) => {
        if (event === "data") {
          onDataListener = callback;
          //need to pass a "?" to the callback to resolve the promise here
          onDataListener("?");
          return this;
        }
      });
    });

    afterEach(() => {
      streamStub = undefined;
      onDataListener = undefined;
    });

    it("writes code input to stream", async () => {
      let onDataListener;
      streamStub.on.callsFake((event, callback) => {
        if (event === "data") {
          onDataListener = callback;
          //need to pass a "?" to the callback to resolve the promise here
          onDataListener("?");
          return this;
        }
      });

      try {
        await session.setup();
      } catch (err) {
        const error: Error = err;
        assert.fail(error.message);
      }

      streamStub.write.callsFake((chunk, cb) => {
        if (chunk === "%put --vscode-sas-extension-submit-end--;\n") {
          if (cb) {
            cb(null);
          }

          if (onDataListener) {
            //need to pass a "?" to the callback to resolve the promise here
            onDataListener("?");
          }
        }
        return true;
      });
      await session.run("test code").catch((err) => assert.fail(err));

      expect(streamStub.write.calledWith("test code\n")).to.be.true;
      expect(
        streamStub.write.calledWith(
          "%put --vscode-sas-extension-submit-end--;\n"
        )
      ).to.be.true;
    });

    it("runs long-running code to completion", async () => {
      let onDataListener;
      streamStub.on.callsFake((event, callback) => {
        if (event === "data") {
          onDataListener = callback;
          //need to pass a "?" to the callback to resolve the promise here
          onDataListener("?");
          return this;
        }
      });

      try {
        await session.setup();
      } catch (err) {
        const error: Error = err;
        assert.fail(error.message);
      }

      streamStub.write.callsFake((chunk, cb) => {
        if (chunk === "%put --vscode-sas-extension-submit-end--;\n") {
          if (cb) {
            cb(null);
          }

          if (onDataListener) {
            //here we define long running as a value that exceeds the timeout values set in the provider
            sandbox.clock.tick(50 * seconds);
            //need to pass a "?" to the callback to resolve the promise here
            onDataListener("?");
          }
        }
        return true;
      });
      await session.run("test code").catch((err) => assert.fail(err));
    });
  });

  describe("close", () => {
    let streamStub: StubbedInstance<ClientChannel>;
    let onDataListener;

    beforeEach(() => {
      streamStub = stubInterface<ClientChannel>();
      sandbox.stub(Client.prototype, "connect").callsFake(function () {
        this.emit("ready");
        return undefined;
      });

      sandbox.stub(Client.prototype, "shell").callsFake((callback) => {
        callback(null, streamStub);
        return this;
      });

      streamStub.on.callsFake((event, callback) => {
        if (event === "data") {
          onDataListener = callback;
          //need to pass a "?" to the callback to resolve the promise here
          onDataListener("?");
          return this;
        }
      });
    });

    afterEach(() => {
      streamStub = undefined;
      onDataListener = undefined;
    });

    it("writes closing commands to ssh session", async () => {
      streamStub.write.callsFake((chunk, cb) => {
        if (chunk === "%put --vscode-sas-extension-submit-end--;\n") {
          if (cb) {
            cb(null);
          }

          if (onDataListener) {
            //need to pass a "?" to the callback to resolve the promise here
            onDataListener("?");
          }
        }
        return true;
      });

      try {
        await session.setup();
        await session.close();
      } catch (err) {
        assert.fail(err);
      }

      expect(streamStub.write.calledWith("endsas;\n")).to.be.true;
      expect(streamStub.close.calledOnce).to.be.true;
    });
  });
});
