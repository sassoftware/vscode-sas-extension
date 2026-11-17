import { expect } from "chai";
import * as sinon from "sinon";
import { Readable } from "stream";

import * as computeApi from "../../../src/connection/rest/api/compute";
import { Configuration } from "../../../src/connection/rest/api/configuration";
import * as restCommon from "../../../src/connection/rest/common";
import { ComputeFile } from "../../../src/connection/rest/file";
import { ComputeJob } from "../../../src/connection/rest/job";
import { ComputeSession } from "../../../src/connection/rest/session";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

describe("ComputeFile table exports", () => {
  let sandbox: sinon.SinonSandbox;
  let files: ReturnType<typeof computeApi.FilesApi>;
  let jobs: ReturnType<typeof computeApi.JobsApi>;
  let logs: ReturnType<typeof computeApi.LogsApi>;
  let variables: ReturnType<typeof computeApi.VariablesApi>;
  let deleteFile: sinon.SinonStub;
  let deleteFileref: sinon.SinonStub;
  let getFile: sinon.SinonStub;
  let deleteJob: sinon.SinonStub;
  let getJobState: sinon.SinonStub;
  let updateJobState: sinon.SinonStub;
  let getJobLog: sinon.SinonStub;
  let getVariable: sinon.SinonStub;
  let execute: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    deleteFile = sandbox.stub().resolves();
    deleteFileref = sandbox.stub().resolves();
    getFile = sandbox.stub().resolves({
      data: Readable.from(["csv-data"]),
    });
    files = {
      ...computeApi.FilesApi(),
      deleteFile,
      deleteFileref,
      getFile,
    };
    deleteJob = sandbox.stub().resolves();
    getJobState = sandbox.stub().resolves({
      data: "completed",
      headers: { etag: "etag-2" },
    });
    updateJobState = sandbox.stub().resolves();
    jobs = {
      ...computeApi.JobsApi(),
      deleteJob,
      getJobState,
      updateJobState,
    };
    getJobLog = sandbox.stub().resolves({
      data: { items: [], count: 0, links: [] },
    });
    logs = { ...computeApi.LogsApi(), getJobLog };
    getVariable = sandbox.stub().resolves({
      data: { value: "1" },
    });
    variables = { ...computeApi.VariablesApi(), getVariable };
    sandbox
      .stub(restCommon, "getApiConfig")
      // Stub API factories with only the methods exercised by the exporter.
      .returns(new Configuration({ baseOptions: {} }));
    sandbox.stub(computeApi, "FilesApi").returns(files);
    sandbox.stub(computeApi, "JobsApi").returns(jobs);
    sandbox.stub(computeApi, "LogsApi").returns(logs);
    sandbox.stub(computeApi, "VariablesApi").returns(variables);
    const completedJob = new ComputeJob("job-1");
    completedJob.etag = "etag-1";
    execute = sandbox
      .stub(ComputeSession.prototype, "execute")
      .resolves(completedJob);
  });

  afterEach(() => sandbox.restore());

  it("generates metadata-driven CSV and removes the file, fileref, and job", async () => {
    const exported = await new ComputeFile("session-1").createTableExport(
      { library: "WORK", name: "TABLE" },
      new AbortController().signal,
    );
    const chunks: string[] = [];
    for await (const chunk of exported.stream) {
      chunks.push(Buffer.from(chunk).toString("utf8"));
    }

    expect(chunks.join("")).to.equal("csv-data");
    const submittedCode = execute.firstCall.args[0].code.join("\n");
    expect(submittedCode).to.contain("varfmt(source, column)");
    expect(submittedCode).to.contain("formats[column]='BEST12.'");
    expect(submittedCode).to.contain("link te_js");
    expect(submittedCode).to.contain("length te");
    expect(submittedCode).not.to.contain("_te_mantissa");
    expect(submittedCode).to.contain(
      "if missing(getvarn(source, column)) then cell='';",
    );
    expect(submittedCode).to.contain("prxparse");
    expect(submittedCode).to.contain(
      "round(getvarn(source, column), 10**(floor(log10(abs(getvarn(source, column))))-5))",
    );
    expect(submittedCode).to.contain(
      "te_js:"
    );
    expect(submittedCode).to.match(/te[a-f0-9]{16}e=te[a-f0-9]{16}e-1;/);
    expect(submittedCode).to.match(/te[a-f0-9]{16}n=te[a-f0-9]{16}n-1;/);
    expect(submittedCode).to.contain("encoding='utf-8'");
    expect(submittedCode).to.contain("row_index+1");
    expect(submittedCode).to.contain(`put '""'`);

    await exported.dispose();
    expect(deleteFile.calledOnce).to.equal(true);
    expect(deleteFile.firstCall.args[0].sessionId).to.equal("session-1");
    expect(deleteFile.firstCall.args[0].fileref).to.match(/^dl[0-9a-f]{6}$/);
    expect(deleteFileref.calledOnce).to.equal(true);
    expect(deleteJob.calledOnce).to.equal(true);
    expect(deleteJob.firstCall.args[0]).to.deep.equal({
      sessionId: "session-1",
      jobId: "job-1",
    });
  });

  it("requires the producer success variable before downloading the file", async () => {
    getVariable.resolves({ data: { value: "0" } });

    let failure: unknown;
    try {
      await new ComputeFile("session-1").createTableExport(
        { library: "WORK", name: "TABLE" },
        new AbortController().signal,
      );
    } catch (error) {
      failure = error;
    }

    expect(errorMessage(failure)).to.contain("producer did not complete");
    expect(getFile.called).to.equal(false);
    expect(deleteFile.calledOnce).to.equal(true);
    expect(deleteFileref.calledOnce).to.equal(true);
    expect(deleteJob.calledOnce).to.equal(true);
  });

  it("uses conditional long polling while waiting for the export job", async () => {
    getJobState
      .onFirstCall()
      .resolves({ status: 200, data: "running", headers: { etag: "etag-2" } });
    getJobState
      .onSecondCall()
      .resolves({ status: 304, data: "", headers: { etag: "etag-2" } });
    getJobState.onThirdCall().resolves({
      status: 200,
      data: "completed",
      headers: { etag: "etag-3" },
    });

    const exported = await new ComputeFile("session-1").createTableExport(
      { library: "WORK", name: "TABLE" },
      new AbortController().signal,
    );

    expect(getJobState.callCount).to.equal(3);
    expect(getJobState.secondCall.args[0]).to.deep.equal({
      sessionId: "session-1",
      jobId: "job-1",
      wait: 1,
      ifNoneMatch: "etag-2",
    });
    expect(getJobState.secondCall.args[1].validateStatus(304)).to.equal(true);
    expect(getJobState.secondCall.args[1].validateStatus(200)).to.equal(true);
    await exported.dispose();
  });

  it("stops a canceled SAS job and cleans all remote export resources", async () => {
    const controller = new AbortController();
    execute.callsFake(async () => {
      controller.abort(new Error("canceled"));
      const job = new ComputeJob("job-1");
      job.etag = "etag-1";
      return job;
    });

    let failure: unknown;
    try {
      await new ComputeFile("session-1").createTableExport(
        { library: "WORK", name: "TABLE" },
        controller.signal,
      );
    } catch (error) {
      failure = error;
    }

    expect(errorMessage(failure)).to.equal("canceled");
    expect(updateJobState.calledOnce).to.equal(true);
    expect(deleteFile.calledOnce).to.equal(true);
    expect(deleteFileref.calledOnce).to.equal(true);
    expect(deleteJob.calledOnce).to.equal(true);
  });

  it("surfaces SAS log failures and still cleans export resources", async () => {
    getJobLog.resolves({
      data: {
        items: [{ type: "error" }],
        count: 1,
        links: [],
      },
    });

    let failure: unknown;
    try {
      await new ComputeFile("session-1").createTableExport(
        { library: "WORK", name: "TABLE" },
        new AbortController().signal,
      );
    } catch (error) {
      failure = error;
    }

    expect(errorMessage(failure)).to.contain("Check the SAS log");
    expect(deleteFile.calledOnce).to.equal(true);
    expect(deleteFileref.calledOnce).to.equal(true);
    expect(deleteJob.calledOnce).to.equal(true);
  });

  it("attempts every cleanup resource when one deletion fails", async () => {
    getVariable.resolves({ data: { value: "0" } });
    deleteFile.rejects(new Error("file cleanup failed"));

    let failure: unknown;
    try {
      await new ComputeFile("session-1").createTableExport(
        { library: "WORK", name: "TABLE" },
        new AbortController().signal,
      );
    } catch (error) {
      failure = error;
    }

    expect(errorMessage(failure)).to.contain("producer did not complete");
    expect(errorMessage(failure)).to.contain("Could not clean up");
    expect(deleteFile.callCount).to.equal(3);
    expect(deleteFileref.calledOnce).to.equal(true);
    expect(deleteJob.calledOnce).to.equal(true);
  });
});
