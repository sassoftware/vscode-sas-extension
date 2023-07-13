import { expect } from "chai";
import proc from "child_process";
import fs from "fs";
import { getSession } from "../../../src/connection/com";
import { scriptContent } from "../../../src/connection/com/script";

import { SinonSandbox, SinonStub, createSandbox } from "sinon";
import { Session } from "../../../src/connection/session";

describe("COM connection", () => {
  let sandbox: SinonSandbox;
  let spawnStub: SinonStub;
  let stdoutStub: SinonStub;
  let stdoutWriteStub: SinonStub;
  let stderrStub: SinonStub;
  let stdinStub: SinonStub;
  let killStub: SinonStub;
  let endStub: SinonStub;
  let session: Session;
  let onDataCallback;

  beforeEach(() => {
    sandbox = createSandbox({
      useFakeTimers: { shouldClearNativeTimers: true },
    });

    spawnStub = sandbox.stub(proc, "spawn");

    stdoutStub = sandbox.stub();
    stdoutWriteStub = sandbox.stub();
    stderrStub = sandbox.stub();
    stdinStub = sandbox.stub();
    endStub = sandbox.stub();
    killStub = sandbox.stub();

    spawnStub.returns({
      stdout: { on: stdoutStub, write: stdoutWriteStub },
      stderr: { on: stderrStub },
      stdin: { write: stdinStub, end: endStub },
      on: sandbox.stub(),
      kill: killStub,
    });

    stdoutStub.callsFake((event, callback) => {
      if (event === "data") {
        //save off the callback to simulate stdout events
        onDataCallback = callback;
      }
    });
    const config = {
      sasOptions: ["-PAGESIZE=MAX"],
      host: "localhost",
    };

    session = getSession(config);
    session.onLogFn = () => {
      return;
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("setup", () => {
    afterEach(async () => {
      await session.close();
    });
    it("creates a well-formed local session", async () => {
      const setupPromise = session.setup();

      onDataCallback(Buffer.from(`WORKDIR="/work/dir"\n`));

      await setupPromise;

      expect(spawnStub.calledWith("powershell.exe /nologo -Command -")).to.be
        .true;

      //using args here allows use of deep equal, that generates a concise diff in the test output on failures
      expect(stdinStub.args[0][0]).to.deep.equal(scriptContent + "\n");
      expect(stdinStub.args[1][0]).to.deep.equal(
        "$runner = New-Object -TypeName SASRunner\n"
      );

      expect(stdinStub.args[2][0]).to.deep.equal(
        `$profileHost = "localhost"\n`
      );
      expect(stdinStub.args[3][0]).to.deep.equal(
        "$runner.Setup($profileHost)\n"
      );
      expect(stdinStub.args[4][0]).to.deep.equal(
        "$runner.ResolveSystemVars()\n"
      );

      expect(stdinStub.args[5][0]).to.deep.equal(
        `$sasOpts=@("-PAGESIZE=MAX")\n`
      );
      expect(stdinStub.args[6][0]).to.deep.equal(
        `$runner.SetOptions($sasOpts)\n`
      );
    });
  });

  describe("run", () => {
    let fsStub: SinonStub;
    beforeEach(async () => {
      fsStub = sandbox.stub(fs, "readFileSync");

      const setupPromise = session.setup();
      onDataCallback(Buffer.from(`WORKDIR=/work/dir`));
      await setupPromise;
    });
    it("calls run function from script", async () => {
      fsStub.returns("content");

      const runPromise = session.run(
        "ods html5;\nproc print data=sashelp.cars;\nrun;"
      );

      //simulate log message for body file
      onDataCallback(Buffer.from("NOTE: Writing HTML5 Body file: sashtml.htm"));
      //simulate end of submission
      onDataCallback(Buffer.from("--vscode-sas-extension-submit-end--"));

      const runResult = await runPromise;
      expect(runResult.html5).to.equal("content");
      expect(runResult.title).to.equal("Results");

      expect(stdinStub.args[7][0]).to.deep.equal(
        `$code=@"\nods html5 path="/work/dir";\nproc print data=sashelp.cars;\nrun;\n%put --vscode-sas-extension-submit-end--;\n"@\n`
      );

      expect(stdinStub.args[8][0]).to.deep.equal(`$runner.Run($code)\n`);
    });
  });

  describe("close", () => {
    beforeEach(async () => {
      const setupPromise = session.setup();
      onDataCallback(Buffer.from(`WORKDIR=/work/dir`));
      await setupPromise;
    });

    it("closes session gracefully", async () => {
      const closePromise = session.close();

      //we have a lifecycle issue here that currently prevents proper use of expects.
      //the close method sets the child process to undefined which resets the stub state.
      //as a result, the spy call history gets lost. For now just make sure we didnt reject.
      await closePromise;
    });
  });
});
