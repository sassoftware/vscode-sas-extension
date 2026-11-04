import { CancellationTokenSource, env, window } from "vscode";

import { expect } from "chai";
import { get } from "http";
import { createServer } from "net";
import * as sinon from "sinon";
import { Readable } from "stream";

import { HostAttachmentDownloadTarget } from "../../../src/components/LibraryNavigator/HostAttachmentDownloadTarget";

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (!address || typeof address === "string") {
    throw new Error("Test server did not start correctly.");
  }
  return address.port;
}

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

  it("uses a configured fixed proxy route without external URI forwarding", async () => {
    const port = await getAvailablePort();
    let responseBody = "";
    let responseHeaders: Record<string, string | string[] | undefined> = {};
    let openedUrl: URL | undefined;
    const asExternalUri = sandbox.stub(env, "asExternalUri");
    sandbox.stub(env, "openExternal").callsFake(async (uri) => {
      const url = new URL(uri.toString());
      openedUrl = url;
      await new Promise<void>((resolve, reject) => {
        const request = get(
          {
            hostname: "127.0.0.1",
            port: Number(port),
            path: `${url.pathname}${url.search}`,
          },
          (response) => {
            responseHeaders = response.headers;
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => (responseBody += chunk));
            response.on("end", resolve);
          },
        );
        request.once("error", reject);
      });
      return true;
    });

    const target = new HostAttachmentDownloadTarget({
      mode: "fixed-proxy",
      listenHost: "127.0.0.1",
      listenPort: port,
      externalBaseUrl: `https://download.example.test:${port}/sas-download/`,
      authentication: "deployment",
    });
    await target.download("WORK.TABLE.csv", async () => ({
      stream: Readable.from(["header\n", "value\n"]),
      dispose: sinon.stub().resolves(),
    }));

    expect(responseBody).to.equal("header\nvalue\n");
    expect(openedUrl?.pathname).to.match(/^\/sas-download\/[0-9a-f-]+$/);
    expect(openedUrl?.pathname.split("/").at(-1)).to.match(/^[0-9a-f-]+$/);
    expect(responseHeaders["content-disposition"]).to.contain("attachment");
    expect(responseHeaders["cache-control"]).to.equal("no-store");
    expect(responseHeaders["x-content-type-options"]).to.equal("nosniff");
    expect(asExternalUri.called).to.equal(false);
  });

  it("rejects incomplete fixed proxy configuration", () => {
    expect(
      () =>
        new HostAttachmentDownloadTarget({
          mode: "fixed-proxy",
          listenPort: 0,
          externalBaseUrl: "https://download.example.test/sas-download/",
          authentication: "deployment",
        }),
    ).to.throw("listener port is invalid");
  });

  it("rejects public URLs that contain credentials or query parameters", () => {
    expect(
      () =>
        new HostAttachmentDownloadTarget({
          mode: "fixed-proxy",
          listenPort: 46005,
          externalBaseUrl:
            "https://user:password@download.example.test/sas-download/?token=secret",
          authentication: "deployment",
        }),
    ).to.throw("credentials or a fragment");
  });

  it("rejects fixed proxy mode without deployment authentication", () => {
    expect(
      () =>
        new HostAttachmentDownloadTarget({
          mode: "fixed-proxy",
          listenPort: 46005,
          externalBaseUrl: "https://download.example.test/sas-download/",
        }),
    ).to.throw("requires deployment authentication");
  });
});
