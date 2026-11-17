import { CancellationTokenSource, window } from "vscode";

import { expect } from "chai";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as sinon from "sinon";
import { Readable } from "stream";

import LibraryModel from "../../../src/components/LibraryNavigator/LibraryModel";
import {
  LibraryAdapter,
  LibraryItem,
} from "../../../src/components/LibraryNavigator/types";

const createAdapter = (
  overrides: Partial<LibraryAdapter> = {},
): LibraryAdapter => ({
  connect: async () => {},
  deleteTable: async () => {},
  getColumns: async () => ({ count: 0, items: [] }),
  getLibraries: async () => ({ count: 0, items: [] }),
  getRows: async () => ({ count: 0, rows: [] }),
  getRowsAsCSV: async () => ({ count: 0, rows: [] }),
  getTableRowCount: async () => ({ maxNumberOfRowsToRead: 0, rowCount: 0 }),
  getTables: async () => ({ count: 0, items: [] }),
  setup: async () => {},
  ...overrides,
});

const item: LibraryItem = {
  uid: "WORK.TABLE",
  id: "TABLE",
  library: "WORK",
  name: "TABLE",
  type: "table",
  readOnly: false,
};

describe("LibraryModel table download streaming", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(window, "withProgress").callsFake((_options, task) => {
      const token = new CancellationTokenSource();
      return Promise.resolve(task({ report: () => {} }, token.token));
    });
  });

  afterEach(() => sandbox.restore());

  it("uses the metadata exporter and waits for each slow destination write", async () => {
    let releaseFirstWrite = () => {};
    let enterFirstWrite = () => {};
    const firstWriteStarted = new Promise<void>((resolve) => {
      enterFirstWrite = resolve;
    });
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const dispose = sinon.stub().resolves();
    const createTableExport = sinon.stub().resolves({
      stream: Readable.from(["header\n", '"1","value"\n']),
      dispose,
    });
    const adapter = createAdapter({
      supportsTableExport: true,
      createTableExport,
    });
    const model = new LibraryModel(adapter);
    const chunks: string[] = [];
    let writeCount = 0;

    const operation = model.writeTableContents(item, async (chunk) => {
      writeCount++;
      if (writeCount === 1) {
        enterFirstWrite();
        await firstWriteGate;
      }
      chunks.push(Buffer.from(chunk).toString("utf8"));
    });

    await firstWriteStarted;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(writeCount).to.equal(1);
    releaseFirstWrite();

    expect(await operation).to.equal(true);
    expect(createTableExport.calledOnce).to.equal(true);
    expect(chunks.join("")).to.equal('header\n"1","value"\n');
    expect(dispose.calledOnce).to.equal(true);
  });

  it("uses the native paged export path with the adapter page size", async () => {
    const getRowsAsCSV = sinon.stub().resolves({
      rows: [
        { columns: ["INDEX", "NAME"] },
        { cells: ["1", 'quoted "value"'] },
      ],
    });
    const getTableRowCount = sinon.stub().resolves({
      rowCount: 1,
      maxNumberOfRowsToRead: 100,
    });
    const adapter = createAdapter({
      setup: sinon.stub().resolves(),
      getTableRowCount,
      getRowsAsCSV,
    });
    const model = new LibraryModel(adapter);
    const chunks: string[] = [];

    expect(
      await model.writeTableContents(item, async (chunk) => {
        chunks.push(Buffer.from(chunk).toString("utf8"));
      }),
    ).to.equal(true);
    expect(chunks.join("")).to.equal('"INDEX","NAME"\n"1","quoted ""value"""');
    expect(getRowsAsCSV.calledOnce).to.equal(true);
    expect(getRowsAsCSV.firstCall.args).to.deep.equal([item, 0, 100]);
  });

  it("propagates native export failures", async () => {
    const failure = new Error("native CSV export failed");
    const adapter = createAdapter({
      getTableRowCount: sinon.stub().resolves({
        rowCount: 1,
        maxNumberOfRowsToRead: 100,
      }),
      getRowsAsCSV: sinon.stub().rejects(failure),
    });
    const model = new LibraryModel(adapter);

    let thrown: unknown;
    try {
      await model.writeTableContents(item, async () => {});
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.equal(failure);
  });

  it("disposes the remote exporter when the destination cancels", async () => {
    let writeStarted = () => {};
    const started = new Promise<void>((resolve) => {
      writeStarted = resolve;
    });
    const dispose = sinon.stub().resolves();
    const adapter = createAdapter({
      supportsTableExport: true,
      createTableExport: sinon.stub().resolves({
        stream: Readable.from(["csv"]),
        dispose,
      }),
    });
    const model = new LibraryModel(adapter);
    const controller = new AbortController();
    const operation = model.writeTableContents(
      item,
      async (_chunk, signal) =>
        new Promise<void>((_resolve, reject) => {
          writeStarted();
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
      controller.signal,
    );

    await started;
    controller.abort(new Error("destination canceled"));
    let failure: unknown;
    try {
      await operation;
    } catch (error) {
      failure = error;
    }
    expect(
      failure instanceof Error ? failure.message : String(failure),
    ).to.equal("destination canceled");
    expect(dispose.calledOnce).to.equal(true);
  });

  it("uses canonical web download command IDs and preserves submenu placements", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(__dirname, "../../../../../package.json"), "utf8"),
    );
    const contextMenus = manifest.contributes.menus["view/item/context"];
    const desktopDownload = contextMenus.find(
      (entry: { command?: string }) => entry.command === "SAS.downloadTable",
    );
    const downloadMenu = contextMenus.find(
      (entry: { submenu?: string }) => entry.submenu === "sas.library.download",
    );
    const destinations = manifest.contributes.menus["sas.library.download"];

    expect(
      manifest.contributes.commands.map(
        (command: { command: string }) => command.command,
      ),
    )
      .to.include.members([
        "SAS.downloadTable",
        "SAS.downloadTableRemoteWorkspace",
        "SAS.downloadTableToComputer",
      ])
      .and.not.to.include.members([
        "SAS.prototype.downloadTableRemoteWorkspace",
        "SAS.prototype.downloadTableToComputer",
      ]);
    expect(desktopDownload?.when).to.contain("!isWeb");
    expect(desktopDownload?.group).to.equal("download@0");
    expect(downloadMenu?.when).to.contain("isWeb");
    expect(downloadMenu?.group).to.equal("download@0");
    expect(
      destinations.map((entry: { command: string }) => entry.command),
    ).to.deep.equal([
      "SAS.downloadTableRemoteWorkspace",
      "SAS.downloadTableToComputer",
    ]);
    expect(
      destinations.map((entry: { group: string }) => entry.group),
    ).to.deep.equal(["download@0", "download@1"]);
  });
});
