import { CancellationTokenSource, env, window } from "vscode";

import { expect } from "chai";
import { get } from "http";
import * as sinon from "sinon";
import { Readable } from "stream";

import { HostAttachmentDownloadTarget } from "../../../src/components/LibraryNavigator/HostAttachmentDownloadTarget";

describe("HostAttachmentDownloadTarget", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(window, "withProgress").callsFake((_options, task) => {
      const cancellation = new CancellationTokenSource();
      return Promise.resolve(
        task({ report: () => undefined }, cancellation.token),
      );
    });
  });

  afterEach(() => sandbox.restore());

  it("prepares the export before opening the attachment URL", async () => {
    const events: string[] = [];
    let responseStatus = 0;
    let responseHeaders: Record<string, string | string[] | undefined> = {};
    let responseBody = "";
    sandbox.stub(env, "asExternalUri").callsFake((uri) => Promise.resolve(uri));
    sandbox.stub(env, "openExternal").callsFake(async (uri) => {
      events.push("open");
      const url = new URL(uri.toString());
      url.hostname = "127.0.0.1";
      await new Promise<void>((resolve, reject) => {
        const request = get(url, (response) => {
          responseStatus = response.statusCode ?? 0;
          responseHeaders = response.headers;
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => (responseBody += chunk));
          response.on("end", resolve);
        });
        request.once("error", reject);
      });
      return true;
    });

    const dispose = sinon.stub().resolves();
    const target = new HostAttachmentDownloadTarget();
    await target.download("WORK.TABLE.csv", async () => {
      events.push("export");
      return { stream: Readable.from(["header\n", "value\n"]), dispose };
    });

    expect(events).to.deep.equal(["export", "open"]);
    expect(responseStatus).to.equal(200);
    expect(responseHeaders["content-disposition"]).to.contain("attachment");
    expect(responseBody).to.equal("header\nvalue\n");
    expect(dispose.calledOnce).to.equal(true);
  });
});
