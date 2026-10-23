import { Uri } from "vscode";

import { expect } from "chai";
import * as sinon from "sinon";
import { Writable } from "stream";

import { NodeFileDownloadTarget } from "../../../src/components/LibraryNavigator/NodeFileDownloadTarget";

describe("NodeFileDownloadTarget", () => {
  it("streams to uri.fsPath, applies backpressure, and waits for completion", async () => {
    const filePath = Uri.file("/workspace/work.table.csv").fsPath;
    const chunks: string[] = [];
    const openedPaths: string[] = [];
    let activeWrites = 0;
    let maximumActiveWrites = 0;
    const target = new NodeFileDownloadTarget((path) => {
      openedPaths.push(path);
      return new Writable({
        highWaterMark: 1,
        write(chunk, _encoding, callback) {
          activeWrites++;
          maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
          setTimeout(() => {
            chunks.push(Buffer.from(chunk).toString("utf8"));
            activeWrites--;
            callback();
          }, 1);
        },
      });
    });

    const controller = new AbortController();
    const completed = await target.write(Uri.file(filePath), async (write) => {
      await write(new TextEncoder().encode("header\n"), controller.signal);
      await write(new TextEncoder().encode('"1","value"'), controller.signal);
      return true;
    });

    expect(openedPaths).to.deep.equal([filePath]);
    expect(chunks.join("")).to.equal('header\n"1","value"');
    expect(maximumActiveWrites).to.equal(1);
    expect(completed).to.equal(true);
  });

  it("closes the destination and preserves the export failure", async () => {
    let output: Writable | undefined;
    const target = new NodeFileDownloadTarget(() => {
      output = new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
      return output;
    });
    const failure = new Error("table export failed");

    let actualFailure: unknown;
    try {
      await target.write(Uri.file("/workspace/work.table.csv"), async () => {
        throw failure;
      });
    } catch (error) {
      actualFailure = error;
    }

    expect(actualFailure).to.equal(failure);
    expect(output?.destroyed).to.equal(true);
  });

  it("returns cancellation without claiming a completed download", async () => {
    const finish = sinon.spy();
    const target = new NodeFileDownloadTarget(() => {
      const stream = new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
      stream.on("finish", finish);
      return stream;
    });

    const completed = await target.write(
      Uri.file("/workspace/work.table.csv"),
      async (write) => {
        await write(
          new TextEncoder().encode("partial"),
          new AbortController().signal,
        );
        return false;
      },
    );

    expect(completed).to.equal(false);
    expect(finish.calledOnce).to.equal(true);
  });

  it("cancels a write waiting for backpressure", async () => {
    const controller = new AbortController();
    const failure = new Error("download canceled");
    const target = new NodeFileDownloadTarget(
      () =>
        new Writable({
          highWaterMark: 1,
          write() {},
        }),
    );

    const operation = target.write(
      Uri.file("/workspace/work.table.csv"),
      async (write) => {
        const pendingWrite = write(
          new TextEncoder().encode("chunk"),
          controller.signal,
        );
        controller.abort(failure);
        await pendingWrite;
        return true;
      },
    );

    let actualFailure: unknown;
    try {
      await operation;
    } catch (error) {
      actualFailure = error;
    }
    expect(actualFailure).to.be.instanceOf(Error);
    expect(actualFailure).to.have.property("name", "AbortError");
    expect(actualFailure).to.have.property("cause", failure);
  });
});
