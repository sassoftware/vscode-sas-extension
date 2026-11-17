import { expect } from "chai";
import * as sinon from "sinon";
import { Readable } from "stream";

import * as computeApi from "../../../src/connection/rest/api/compute";
import * as restCommon from "../../../src/connection/rest/common";
import { ComputeFile } from "../../../src/connection/rest/file";
import { ComputeSession } from "../../../src/connection/rest/session";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

describe("ComputeFile table exports", () => {
  let sandbox: sinon.SinonSandbox;
  let files: {
    deleteFile: sinon.SinonStub;
    deleteFileref: sinon.SinonStub;
    getFile: sinon.SinonStub;
  };
  let jobs: {
    deleteJob: sinon.SinonStub;
    getJobState: sinon.SinonStub;
    updateJobState: sinon.SinonStub;
  };
  let logs: { getJobLog: sinon.SinonStub };
  let variables: { getVariable: sinon.SinonStub };
  let execute: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    files = {
      deleteFile: sandbox.stub().resolves(),
      deleteFileref: sandbox.stub().resolves(),
      getFile: sandbox.stub().resolves({
        data: Readable.from(["csv-data"]),
      }),
    };
    jobs = {
      deleteJob: sandbox.stub().resolves(),
      getJobState: sandbox.stub().resolves({
        data: "completed",
        headers: { etag: "etag-2" },
      }),
      updateJobState: sandbox.stub().resolves(),
    };
    logs = {
      getJobLog: sandbox.stub().resolves({
        data: { items: [], count: 0, links: [] },
      }),
    };
    variables = {
      getVariable: sandbox.stub().resolves({ data: { value: "1" } }),
    };
    sandbox
      .stub(restCommon, "getApiConfig")
      // Stub API factories with only the methods exercised by the exporter.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .returns({} as ReturnType<typeof restCommon.getApiConfig>);
    sandbox
      .stub(computeApi, "FilesApi")
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .returns(files as unknown as ReturnType<typeof computeApi.FilesApi>);
    sandbox
      .stub(computeApi, "JobsApi")
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .returns(jobs as unknown as ReturnType<typeof computeApi.JobsApi>);
    sandbox
      .stub(computeApi, "LogsApi")
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .returns(logs as unknown as ReturnType<typeof computeApi.LogsApi>);
    sandbox
      .stub(computeApi, "VariablesApi")
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .returns(
        variables as unknown as ReturnType<typeof computeApi.VariablesApi>,
      );
    execute = sandbox
      .stub(ComputeSession.prototype, "execute")
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .resolves({ id: "job-1", etag: "etag-1" } as Awaited<
        ReturnType<ComputeSession["execute"]>
      >);
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
    expect(submittedCode).to.contain("encoding='utf-8'");
    expect(submittedCode).to.contain("row_index+1");
    expect(submittedCode).to.contain(`put '""'`);

    await exported.dispose();
    expect(files.deleteFile.calledOnce).to.equal(true);
    expect(files.deleteFile.firstCall.args[0].sessionId).to.equal("session-1");
    expect(files.deleteFile.firstCall.args[0].fileref).to.match(
      /^dl[0-9a-f]{6}$/,
    );
    expect(files.deleteFileref.calledOnce).to.equal(true);
    expect(jobs.deleteJob.calledOnce).to.equal(true);
    expect(jobs.deleteJob.firstCall.args[0]).to.deep.equal({
      sessionId: "session-1",
      jobId: "job-1",
    });
  });

  it("requires the producer success variable before downloading the file", async () => {
    variables.getVariable.resolves({ data: { value: "0" } });

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
    expect(files.getFile.called).to.equal(false);
    expect(files.deleteFile.calledOnce).to.equal(true);
    expect(files.deleteFileref.calledOnce).to.equal(true);
    expect(jobs.deleteJob.calledOnce).to.equal(true);
  });

  it("uses conditional long polling while waiting for the export job", async () => {
    jobs.getJobState
      .onFirstCall()
      .resolves({ status: 200, data: "running", headers: { etag: "etag-2" } });
    jobs.getJobState
      .onSecondCall()
      .resolves({ status: 304, data: "", headers: { etag: "etag-2" } });
    jobs.getJobState.onThirdCall().resolves({
      status: 200,
      data: "completed",
      headers: { etag: "etag-3" },
    });

    const exported = await new ComputeFile("session-1").createTableExport(
      { library: "WORK", name: "TABLE" },
      new AbortController().signal,
    );

    expect(jobs.getJobState.callCount).to.equal(3);
    expect(jobs.getJobState.secondCall.args[0]).to.deep.equal({
      sessionId: "session-1",
      jobId: "job-1",
      wait: 1,
      ifNoneMatch: "etag-2",
    });
    expect(jobs.getJobState.secondCall.args[1].validateStatus(304)).to.equal(
      true,
    );
    expect(jobs.getJobState.secondCall.args[1].validateStatus(200)).to.equal(
      true,
    );
    await exported.dispose();
  });

  it("stops a canceled SAS job and cleans all remote export resources", async () => {
    const controller = new AbortController();
    execute.callsFake(async () => {
      controller.abort(new Error("canceled"));
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return { id: "job-1", etag: "etag-1" } as Awaited<
        ReturnType<ComputeSession["execute"]>
      >;
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
    expect(jobs.updateJobState.calledOnce).to.equal(true);
    expect(files.deleteFile.calledOnce).to.equal(true);
    expect(files.deleteFileref.calledOnce).to.equal(true);
    expect(jobs.deleteJob.calledOnce).to.equal(true);
  });

  it("surfaces SAS log failures and still cleans export resources", async () => {
    logs.getJobLog.resolves({
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
    expect(files.deleteFile.calledOnce).to.equal(true);
    expect(files.deleteFileref.calledOnce).to.equal(true);
    expect(jobs.deleteJob.calledOnce).to.equal(true);
  });
});
