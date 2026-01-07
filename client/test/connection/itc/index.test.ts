import * as vscode from "vscode";

import { expect } from "chai";
import proc from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { SinonSandbox, SinonStub, createSandbox } from "sinon";
import { stubInterface } from "ts-sinon";
import { v4 } from "uuid";

import { setContext } from "../../../src/components/ExtensionContext";
import { getSession } from "../../../src/connection/itc";
import { getScript } from "../../../src/connection/itc/script";
import { LineCodes, Tags } from "../../../src/connection/itc/script/env.json";
import { ITCProtocol } from "../../../src/connection/itc/types";
import { Session } from "../../../src/connection/session";
import { extensionContext } from "../../../src/node/extension";

describe("ITC connection", () => {
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
    sandbox = createSandbox({});

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

    const secretStore = stubInterface<vscode.SecretStorage>();
    const stubbedExtensionContext: vscode.ExtensionContext = {
      ...extensionContext,
      globalStorageUri: vscode.Uri.from({ scheme: "file", path: __dirname }),
      secrets: secretStore,
    };

    setContext(stubbedExtensionContext);

    session = getSession(config, ITCProtocol.COM);
    session.onExecutionLogFn = () => {
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

      onDataCallback(Buffer.from(`${Tags.WorkDirStartTag}`));
      onDataCallback(Buffer.from(`/work/dir`));
      onDataCallback(Buffer.from(`${Tags.WorkDirEndTag}`));

      await setupPromise;

      expect(
        spawnStub.calledWith(
          "chcp 65001 >NUL & powershell.exe -NonInteractive -NoProfile -Command -",
        ),
      ).to.be.true;

      //using args here allows use of deep equal, that generates a concise diff in the test output on failures
      expect(stdinStub.args[0][0]).to.deep.equal(getScript({}) + "\n");
      expect(stdinStub.args[1][0]).to.deep.equal(
        "$runner = New-Object -TypeName SASRunner\n",
      );

      expect(stdinStub.args[2][0]).to.deep.equal(
        `$profileHost = "localhost"\n`,
      );
      expect(stdinStub.args[3][0]).to.deep.equal(`$port = 0\n`);
      expect(stdinStub.args[4][0]).to.deep.equal(`$protocol = 0\n`);
      expect(stdinStub.args[5][0]).to.deep.equal(`$username = ""\n`);
      expect(stdinStub.args[6][0]).to.deep.equal(`$password = ""\n`);
      expect(stdinStub.args[7][0]).to.deep.equal(`$serverName = "ITC Local"\n`);
      expect(stdinStub.args[8][0]).to.deep.equal(`$displayLang = "en"\n`);
      expect(stdinStub.args[9][0]).to.deep.equal(
        "$runner.Setup($profileHost,$username,$password,$port,$protocol,$serverName,$displayLang)\n",
      );
      expect(stdinStub.args[10][0]).to.deep.equal(
        "$runner.ResolveSystemVars()\n",
      );

      expect(stdinStub.args[11][0]).to.deep.equal(
        `$sasOpts=@("-PAGESIZE=MAX")\n`,
      );
      expect(stdinStub.args[12][0]).to.deep.equal(
        `$runner.SetOptions($sasOpts)\n`,
      );
    });
  });

  describe("run", () => {
    const html5 = '<div id="IDX">';
    const htmlLocation = v4();
    const tempHtmlPath = join(__dirname, `${htmlLocation}.htm`);
    beforeEach(async () => {
      writeFileSync(tempHtmlPath, html5);
      const setupPromise = session.setup();
      onDataCallback(Buffer.from(`${Tags.WorkDirStartTag}`));
      onDataCallback(Buffer.from(`/work/dir`));
      onDataCallback(Buffer.from(`${Tags.WorkDirEndTag}`));
      await setupPromise;
    });
    afterEach(() => {
      try {
        unlinkSync(tempHtmlPath);
      } catch (e) {
        // Intentionally blank
      }
    });
    it("calls run function from script", async () => {
      const runPromise = session.run(
        `ods html5(id=vscode);\nproc print data=sashelp.cars;\nrun;`,
      );

      //simulate log message for body file
      onDataCallback(Buffer.from(`ods html5 body="${htmlLocation}.htm"`));
      //simulate end of submission
      onDataCallback(Buffer.from(LineCodes.RunEndCode));
      onDataCallback(Buffer.from(LineCodes.ResultsFetchedCode));

      const runResult = await runPromise;
      expect(runResult.html5).to.equal(html5);
      expect(runResult.title).to.equal("Result");

      expect(stdinStub.args[13][0]).to.deep.equal(
        `$code=
@'
ods html5(id=vscode) path="/work/dir" ;
'@+[environment]::NewLine+@'
proc print data=sashelp.cars;
'@+[environment]::NewLine+@'
run;
'@+[environment]::NewLine+@'
%put --vscode-sas-extension-submit-end--;
'@
`,
      );

      expect(stdinStub.args[14][0]).to.deep.equal(`$runner.Run($code)\n`);
      expect(stdinStub.args[15][0]).to.contain(`$outputFile = "${tempHtmlPath}"
$runner.FetchResultsFile($filePath, $outputFile)
`);
    });
  });

  describe("close", () => {
    beforeEach(async () => {
      const setupPromise = session.setup();
      onDataCallback(Buffer.from(`${Tags.WorkDirStartTag}`));
      onDataCallback(Buffer.from(`/work/dir`));
      onDataCallback(Buffer.from(`${Tags.WorkDirEndTag}`));
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
