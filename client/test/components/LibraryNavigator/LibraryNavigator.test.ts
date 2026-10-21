import { UIKind, Uri, env, window } from "vscode";

import { expect } from "chai";
import * as sinon from "sinon";
import { Readable } from "stream";

import LibraryNavigator from "../../../src/components/LibraryNavigator";
import PaginatedResultSet from "../../../src/components/LibraryNavigator/PaginatedResultSet";
import type {
  LibraryItem,
  TableExport,
} from "../../../src/components/LibraryNavigator/types";
import DataViewer from "../../../src/panels/DataViewer";
import TablePropertiesViewer from "../../../src/panels/TablePropertiesViewer";

interface WebviewMessagePanel {
  webview: {
    postMessage: (message: { command: string }) => boolean;
  };
}

class RefreshTrackingPanel {
  public readonly refreshData = sinon.spy();
}

const createDataViewer = () =>
  new DataViewer(
    Uri.file("C:/temp"),
    "WORK.T_REFRESH",
    new PaginatedResultSet(async () => ({ data: { rows: [], count: 0 } })),
    () => [],
    () => {},
  );

const createTablePropertiesViewer = () =>
  new TablePropertiesViewer(
    Uri.file("C:/temp"),
    "WORK.T_REFRESH",
    {
      name: "T_REFRESH",
      libref: "WORK",
    },
    [
      {
        name: "date",
        type: "num",
        format: "YYMMDD10.",
        index: 2,
        formatCategory: "date",
      },
    ],
    false,
    "",
    async () => ({ name: "T_REFRESH", libref: "WORK" }),
    async () => [
      {
        name: "updatedDate",
        type: "num",
        format: "YYMMDD10.",
        index: 2,
        formatCategory: "date",
      },
    ],
  );

describe("LibraryNavigator refresh flow", async function () {
  it("DataViewer.refreshData posts panel refresh message", () => {
    const dataViewer = createDataViewer();
    const postMessage = sinon.spy();

    const panel: WebviewMessagePanel = {
      webview: {
        postMessage,
      },
    };

    Object.defineProperty(dataViewer, "panel", {
      value: panel,
    });

    dataViewer.refreshData();

    expect(
      postMessage.calledOnceWithExactly({
        command: "panel:refreshData",
      }),
    ).to.equal(true);
  });

  it("refreshOpenTableViewers refreshes open DataViewer and TablePropertiesViewer panels", () => {
    const navigator: LibraryNavigator = Object.create(
      LibraryNavigator.prototype,
    );

    const tableViewer = createDataViewer();
    const tableViewerRefresh = sinon.stub(tableViewer, "refreshData");
    const tablePropertiesViewer = createTablePropertiesViewer();
    const tablePropertiesViewerRefresh = sinon.stub(
      tablePropertiesViewer,
      "refreshData",
    );
    const nonTablePanel = new RefreshTrackingPanel();
    const webviewManager = {
      panels: {
        table: tableViewer,
        tableProperties: tablePropertiesViewer,
        other: nonTablePanel,
      },
    };

    Object.defineProperty(navigator, "webviewManager", {
      value: webviewManager,
    });

    navigator.refreshOpenTableViewers();

    expect(tableViewerRefresh.calledOnce).to.equal(true);
    expect(tablePropertiesViewerRefresh.calledOnce).to.equal(true);
    expect(nonTablePanel.refreshData.called).to.equal(false);
  });
});

describe("LibraryNavigator browser-file export guard", () => {
  it("allows one export at a time and reports when another is already active", async () => {
    const sandbox = sinon.createSandbox();
    // Exercise the private guard without constructing VS Code-dependent collaborators.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const navigator = Object.create(
      LibraryNavigator.prototype,
    ) as LibraryNavigator;
    const showInformationMessage = sandbox.stub(
      window,
      "showInformationMessage",
    );
    const runExport = async (exportTable: () => Promise<void>) => {
      await Reflect.apply(
        Reflect.get(navigator, "runSingleBrowserFileExport"),
        navigator,
        [exportTable],
      );
    };
    let finishExport!: () => void;
    const activeExport = new Promise<void>((resolve) => {
      finishExport = resolve;
    });
    const duplicateExport = sinon.spy(async () => {});

    try {
      const firstExport = runExport(() => activeExport);
      await runExport(duplicateExport);

      expect(duplicateExport.called).to.equal(false);
      expect(showInformationMessage.calledOnce).to.equal(true);
      expect(showInformationMessage.firstCall.args[0]).to.equal(
        "A browser file export is already in progress. Wait for it to finish before starting another.",
      );

      finishExport();
      await firstExport;

      const nextExport = sinon.spy(async () => {});
      await runExport(nextExport);
      expect(nextExport.calledOnce).to.equal(true);
    } finally {
      sandbox.restore();
    }
  });
});

describe("LibraryNavigator unsupported picker fallback", () => {
  it("automatically downloads through the Node host when file picking is unsupported", async () => {
    const sandbox = sinon.createSandbox();
    // Exercise the download handoff without constructing VS Code-dependent collaborators.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const navigator = Object.create(
      LibraryNavigator.prototype,
    ) as LibraryNavigator;
    const item: LibraryItem = {
      uid: "WORK.TABLE",
      id: "TABLE",
      library: "WORK",
      name: "TABLE",
      type: "table",
      readOnly: false,
    };
    const exportResult: TableExport = {
      stream: Readable.from([]),
      dispose: async () => {},
    };
    const createTableExport = sinon.stub().resolves(exportResult);
    const chooseLocalFile = sinon.stub().resolves({ kind: "unsupported" });
    const download = sinon
      .stub()
      .callsFake(
        async (
          fileName: string,
          createExport: (signal: AbortSignal) => Promise<TableExport>,
        ) => {
          expect(fileName).to.equal("work.table.csv");
          const exported = await createExport(new AbortController().signal);
          await exported.dispose();
        },
      );
    Object.defineProperties(navigator, {
      libraryDataProvider: {
        value: {
          assertTableExportSupported: () => {},
          createTableExport,
        },
      },
      browserFileDownloadTarget: {
        value: { chooseLocalFile },
      },
      hostAttachmentDownloadTarget: { value: { download } },
    });
    sandbox.stub(env, "uiKind").value(UIKind.Web);

    try {
      await Reflect.apply(
        Reflect.get(navigator, "downloadTableToComputer"),
        navigator,
        [item],
      );

      expect(download.calledOnce).to.equal(true);
      expect(createTableExport.calledOnce).to.equal(true);
      expect(createTableExport.firstCall.args[0]).to.equal(item);

      chooseLocalFile.resolves({ kind: "cancelled" });
      await Reflect.apply(
        Reflect.get(navigator, "downloadTableToComputer"),
        navigator,
        [item],
      );
      expect(download.calledOnce).to.equal(true);
    } finally {
      sandbox.restore();
    }
  });
});
