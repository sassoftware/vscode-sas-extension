import {
  Disposable,
  UIKind,
  Uri,
  commands,
  env,
  window,
  workspace,
} from "vscode";

import { expect } from "chai";
import * as sinon from "sinon";
import { Readable } from "stream";

import LibraryNavigator from "../../../src/components/LibraryNavigator";
import { FileSystemTableDownloadTarget } from "../../../src/components/LibraryNavigator/FileSystemTableDownloadTarget";
import PaginatedResultSet from "../../../src/components/LibraryNavigator/PaginatedResultSet";
import type {
  LibraryItem,
  TableExport,
} from "../../../src/components/LibraryNavigator/types";
import type { RunResult } from "../../../src/connection";
import { Session } from "../../../src/connection/session";
import DataViewer from "../../../src/panels/DataViewer";
import TablePropertiesViewer from "../../../src/panels/TablePropertiesViewer";

interface WebviewMessagePanel {
  webview: {
    postMessage: (message: { command: string }) => boolean;
  };
}

class RefreshTrackingPanel {
  public readonly refreshData = sinon.spy();
  public readonly invalidateColumns = sinon.spy();
}

class MockSession extends Session {
  protected async establishConnection(): Promise<void> {}

  protected _run(): Promise<RunResult> {
    throw new Error("Method not implemented.");
  }

  protected _close(): Promise<void> | void {}

  public sessionId(): string | undefined {
    return;
  }
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

const createItem = (): LibraryItem => ({
  uid: "WORK.TABLE",
  id: "TABLE",
  library: "WORK",
  name: "TABLE",
  type: "table",
  readOnly: false,
});

type DownloadCommand = (item: LibraryItem) => Promise<void>;

interface DownloadCommandOptions {
  createTableExport?: sinon.SinonStub;
  chooseLocalFile?: sinon.SinonStub;
  hostDownload?: sinon.SinonStub;
}

const createDownloadCommandHandlers = (
  sandbox: sinon.SinonSandbox,
  options: DownloadCommandOptions = {},
) => {
  const handlers = new Map<string, DownloadCommand>();
  const commandSubscriptions: Disposable[] = [];
  sandbox.stub(commands, "registerCommand").callsFake((command, handler) => {
    if (typeof handler === "function") {
      handlers.set(command, handler);
    }
    const subscription = new Disposable(() => {});
    commandSubscriptions.push(subscription);
    return subscription;
  });
  const createTableExport =
    options.createTableExport ?? sandbox.stub().resolves();
  const chooseLocalFile =
    options.chooseLocalFile ?? sandbox.stub().resolves({ kind: "cancelled" });
  const hostDownload = options.hostDownload ?? sandbox.stub().resolves();
  const fileSystemDownload = sandbox
    .stub(FileSystemTableDownloadTarget.prototype, "download")
    .resolves();
  const navigator = Object.create(LibraryNavigator.prototype);

  Object.defineProperties(navigator, {
    libraryDataProvider: {
      value: {
        getSubscriptions: () => [],
        assertTableExportSupported: () => {},
        createTableExport,
      },
    },
    webviewManager: { value: { panels: {} } },
    browserFileExportInProgress: { value: false, writable: true },
    browserFileDownloadTarget: { value: { chooseLocalFile } },
    hostAttachmentDownloadTarget: { value: { download: hostDownload } },
  });

  navigator.getSubscriptions();
  return {
    handler: (command: string, item: LibraryItem) => {
      const handler = handlers.get(command);
      if (!handler) {
        throw new Error(`Command not registered: ${command}`);
      }
      return handler(item);
    },
    hostDownload,
    fileSystemDownload,
    dispose: () =>
      commandSubscriptions.forEach((subscription) => subscription.dispose()),
  };
};

const createNavigatorForSessionChange = (
  panels: Record<string, unknown>,
): Pick<LibraryNavigator, "getSubscriptions"> => {
  const navigator = {
    getSubscriptions: () =>
      Reflect.apply(
        Reflect.get(LibraryNavigator.prototype, "getSubscriptions"),
        navigator,
        [],
      ),
  };

  Object.defineProperty(navigator, "libraryDataProvider", {
    value: {
      getSubscriptions: () => [],
    },
  });

  Object.defineProperty(navigator, "webviewManager", {
    value: {
      panels,
    },
  });
  Object.defineProperty(navigator, "browserFileDownloadTarget", {
    value: new Disposable(() => {}),
  });
  Object.defineProperty(navigator, "hostAttachmentDownloadTarget", {
    value: new Disposable(() => {}),
  });

  return navigator;
};

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
    const navigator = {
      refreshOpenTableViewers: () =>
        Reflect.apply(
          Reflect.get(LibraryNavigator.prototype, "refreshOpenTableViewers"),
          navigator,
          [],
        ),
    };

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

  it("invalidates an open DataViewer when the session changes", () => {
    const sandbox = sinon.createSandbox();
    sandbox
      .stub(commands, "registerCommand")
      .callsFake(() => new Disposable(() => {}));
    const tableViewer = createDataViewer();
    const invalidateColumns = sinon.stub(tableViewer, "invalidateColumns");

    const navigator = createNavigatorForSessionChange({
      table: tableViewer,
    });

    const subscriptions = navigator.getSubscriptions();

    try {
      const session = new MockSession();
      session.close();

      expect(invalidateColumns.calledOnce).to.equal(true);
    } finally {
      subscriptions.forEach((subscription) => subscription.dispose());
      sandbox.restore();
    }
  });

  it("does not invalidate non-DataViewer panels when the session changes", () => {
    const sandbox = sinon.createSandbox();
    sandbox
      .stub(commands, "registerCommand")
      .callsFake(() => new Disposable(() => {}));
    const tableViewer = createDataViewer();
    const invalidateColumns = sinon.stub(tableViewer, "invalidateColumns");

    const nonDataViewer = new RefreshTrackingPanel();

    const navigator = createNavigatorForSessionChange({
      table: tableViewer,
      other: nonDataViewer,
    });

    const subscriptions = navigator.getSubscriptions();

    try {
      const session = new MockSession();
      session.close();

      expect(invalidateColumns.calledOnce).to.equal(true);
      expect(nonDataViewer.invalidateColumns.called).to.equal(false);
    } finally {
      subscriptions.forEach((subscription) => subscription.dispose());
      sandbox.restore();
    }
  });
});

describe("LibraryNavigator browser-file export guard", () => {
  it("allows one export at a time and reports when another is already active", async () => {
    const sandbox = sinon.createSandbox();
    const showInformationMessage = sandbox.stub(
      window,
      "showInformationMessage",
    );
    sandbox.stub(env, "uiKind").value(UIKind.Web);
    let chooseFile!: (choice: { kind: "unsupported" }) => void;
    const fileChoice = new Promise<{ kind: "unsupported" }>((resolve) => {
      chooseFile = resolve;
    });
    let pickerStarted!: () => void;
    const pickerInvoked = new Promise<void>((resolve) => {
      pickerStarted = resolve;
    });
    try {
      const { handler, dispose, hostDownload } = createDownloadCommandHandlers(
        sandbox,
        {
          chooseLocalFile: sandbox.stub().callsFake(() => {
            pickerStarted();
            return fileChoice;
          }),
        },
      );
      const firstExport = handler("SAS.downloadTableToComputer", createItem());
      await pickerInvoked;
      const duplicateExport = handler(
        "SAS.downloadTableToComputer",
        createItem(),
      );

      expect(showInformationMessage.calledOnce).to.equal(true);
      expect(showInformationMessage.firstCall.args[0]).to.equal(
        "A browser file export is already in progress. Wait for it to finish before starting another.",
      );

      chooseFile({ kind: "unsupported" });
      await Promise.all([firstExport, duplicateExport]);
      expect(hostDownload.calledOnce).to.equal(true);
      dispose();
    } finally {
      sandbox.restore();
    }
  });
});

describe("LibraryNavigator remote workspace download destination", () => {
  it("delegates the Remote Workspace command to the standard download command", async () => {
    const sandbox = sinon.createSandbox();
    sandbox.stub(env, "uiKind").value(UIKind.Web);
    const workspaceFoldersDescriptor = Object.getOwnPropertyDescriptor(
      workspace,
      "workspaceFolders",
    );
    Object.defineProperty(workspace, "workspaceFolders", {
      configurable: true,
      value: [{ uri: Uri.parse("vscode-remote://ssh-remote+host/workspace") }],
    });
    const executeCommand = sandbox.stub(commands, "executeCommand").resolves();

    try {
      const { handler, dispose } = createDownloadCommandHandlers(sandbox);
      const item = createItem();

      await handler("SAS.downloadTableRemoteWorkspace", item);

      expect(
        executeCommand.calledOnceWithExactly("SAS.downloadTable", item),
      ).to.equal(true);
      dispose();
    } finally {
      if (workspaceFoldersDescriptor) {
        Object.defineProperty(
          workspace,
          "workspaceFolders",
          workspaceFoldersDescriptor,
        );
      } else {
        Reflect.deleteProperty(workspace, "workspaceFolders");
      }
      sandbox.restore();
    }
  });

  it("directs local destinations to This Computer instead of streaming remotely", async () => {
    const sandbox = sinon.createSandbox();
    const showInformationMessage = sandbox.stub(
      window,
      "showInformationMessage",
    );
    sandbox.stub(env, "uiKind").value(UIKind.Web);
    const workspaceFoldersDescriptor = Object.getOwnPropertyDescriptor(
      workspace,
      "workspaceFolders",
    );
    Object.defineProperty(workspace, "workspaceFolders", {
      configurable: true,
      value: [{ uri: Uri.parse("vscode-remote://ssh-remote+host/workspace") }],
    });

    try {
      const { handler, dispose } = createDownloadCommandHandlers(sandbox);
      const showSaveDialog = sandbox
        .stub(window, "showSaveDialog")
        .resolves(Uri.file("/local/work.table.csv"));

      await handler("SAS.downloadTable", createItem());

      expect(showSaveDialog.calledOnce).to.equal(true);
      expect(showInformationMessage.calledOnce).to.equal(true);
      expect(showInformationMessage.firstCall.args[0]).to.equal(
        'To download this table locally, cancel this dialog and choose "This Computer" from the Download menu.',
      );
      dispose();
    } finally {
      if (workspaceFoldersDescriptor) {
        Object.defineProperty(
          workspace,
          "workspaceFolders",
          workspaceFoldersDescriptor,
        );
      } else {
        Reflect.deleteProperty(workspace, "workspaceFolders");
      }
      sandbox.restore();
    }
  });

  it("keeps remote workspace destinations on the existing streaming path", async () => {
    const sandbox = sinon.createSandbox();
    const showInformationMessage = sandbox.stub(
      window,
      "showInformationMessage",
    );
    sandbox.stub(env, "uiKind").value(UIKind.Web);
    const workspaceFoldersDescriptor = Object.getOwnPropertyDescriptor(
      workspace,
      "workspaceFolders",
    );
    Object.defineProperty(workspace, "workspaceFolders", {
      configurable: true,
      value: [{ uri: Uri.parse("vscode-remote://ssh-remote+host/workspace") }],
    });

    try {
      const { handler, dispose, fileSystemDownload } =
        createDownloadCommandHandlers(sandbox);
      const showSaveDialog = sandbox
        .stub(window, "showSaveDialog")
        .resolves(Uri.parse("vscode-remote://ssh-remote+host/work.table.csv"));
      sandbox.stub(window, "withProgress").resolves();

      await handler("SAS.downloadTable", createItem());

      expect(showSaveDialog.calledOnce).to.equal(true);
      expect(fileSystemDownload.calledOnce).to.equal(true);
      expect(showInformationMessage.called).to.equal(false);
      dispose();
    } finally {
      if (workspaceFoldersDescriptor) {
        Object.defineProperty(
          workspace,
          "workspaceFolders",
          workspaceFoldersDescriptor,
        );
      } else {
        Reflect.deleteProperty(workspace, "workspaceFolders");
      }
      sandbox.restore();
    }
  });
});

describe("LibraryNavigator unsupported picker fallback", () => {
  it("automatically downloads through the Node host when file picking is unsupported", async () => {
    const sandbox = sinon.createSandbox();
    const item = createItem();
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
    sandbox.stub(env, "uiKind").value(UIKind.Web);

    try {
      const { handler, dispose } = createDownloadCommandHandlers(sandbox, {
        createTableExport,
        chooseLocalFile,
        hostDownload: download,
      });

      await handler("SAS.downloadTableToComputer", item);

      expect(download.calledOnce).to.equal(true);
      dispose();
      expect(createTableExport.calledOnce).to.equal(true);
      expect(createTableExport.firstCall.args[0]).to.equal(item);

      chooseLocalFile.resolves({ kind: "cancelled" });
      await handler("SAS.downloadTableToComputer", item);
      expect(download.calledOnce).to.equal(true);
    } finally {
      sandbox.restore();
    }
  });
});
