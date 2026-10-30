import {
  Disposable,
  Uri,
  ViewColumn,
  WebviewOptions,
  WebviewPanel,
  WebviewPanelSerializer,
  l10n,
  window,
} from "vscode";

import { expect } from "chai";
import { readFileSync } from "fs";
import { join } from "path";
import * as sinon from "sinon";

import { BrowserDownloadChunkBuffer } from "../../../src/components/LibraryNavigator/BrowserFileDownloadTarget/BrowserDownloadChunkBuffer";
import { BrowserDownloadWebview } from "../../../src/components/LibraryNavigator/BrowserFileDownloadTarget/BrowserDownloadWebview";
import { deserializeBrowserDownloadWebviewState } from "../../../src/components/LibraryNavigator/BrowserFileDownloadTarget/BrowserDownloadWebviewState";
import { BrowserFileDownloadTarget } from "../../../src/components/LibraryNavigator/BrowserFileDownloadTarget/BrowserFileDownloadTarget";
import { MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES } from "../../../src/components/LibraryNavigator/BrowserFileDownloadTarget/constants";
import { WebView, WebViewManager } from "../../../src/panels/WebviewManager";
import {
  type BrowserDownloadLocalizedMessages,
  browserDownloadMessages,
} from "../../../src/webview/BrowserDownloadMessages";

interface MockPanel {
  visible: boolean;
  active: boolean;
  title: string;
  webview: {
    options: WebviewOptions;
    html: string;
    cspSource: string;
    asWebviewUri: (uri: Uri) => Uri;
    onDidReceiveMessage: (
      listener: (message: Record<string, unknown>) => void,
    ) => void;
    postMessage: (message: Record<string, unknown>) => Promise<boolean>;
  };
  onDidDispose: (listener: () => void) => void;
  onDidChangeViewState: (
    listener: (event: { webviewPanel: MockPanel }) => void,
  ) => void;
  reveal: (viewColumn?: ViewColumn, preserveFocus?: boolean) => void;
  dispose: () => void;
}

class TestWebView extends WebView {
  public body(): string {
    return "<main>Existing webview</main>";
  }

  public l10nMessages(): Record<string, string> {
    return {};
  }

  public scripts(): string[] {
    return [];
  }

  public styles(): string[] {
    return [];
  }

  public processMessage(): void {}
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isUint8Array = (value: unknown): value is Uint8Array =>
  value instanceof Uint8Array;

interface CommandContribution {
  command: string;
  title: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCommandContribution = (value: unknown): value is CommandContribution =>
  isRecord(value) &&
  typeof value.command === "string" &&
  typeof value.title === "string";

const isCommandManifest = (
  value: unknown,
): value is { contributes: { commands: CommandContribution[] } } =>
  isRecord(value) &&
  isRecord(value.contributes) &&
  Array.isArray(value.contributes.commands) &&
  value.contributes.commands.every(isCommandContribution);

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) &&
  Object.values(value).every((item) => typeof item === "string");

describe("BrowserFileDownloadTarget", () => {
  let sandbox: sinon.SinonSandbox;
  let target: BrowserFileDownloadTarget;
  let panel: MockPanel;
  let serializer: WebviewPanelSerializer | undefined;
  let receiveMessage: (message: Record<string, unknown>) => void;
  let onDispose: () => void = () => undefined;
  let onViewState: (event: { webviewPanel: MockPanel }) => void = () =>
    undefined;
  let automaticReady: boolean;
  let signalReady: () => void;
  let disposed = false;
  let writes: Record<string, unknown>[];
  let postedMessages: Record<string, unknown>[];
  let rejectWrite = false;
  let unsupported = false;
  let activeWrites = 0;
  let maximumActiveWrites = 0;
  let createWebviewPanelStub: sinon.SinonStub;
  let revealCalls: [ViewColumn | undefined, boolean | undefined][];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    writes = [];
    postedMessages = [];
    rejectWrite = false;
    unsupported = false;
    activeWrites = 0;
    maximumActiveWrites = 0;
    revealCalls = [];
    automaticReady = true;
    signalReady = () => receiveMessage({ type: "ready" });
    disposed = false;
    panel = {
      visible: true,
      active: true,
      title: "",
      webview: {
        options: { enableScripts: false, enableForms: true },
        html: "",
        cspSource: "vscode-webview-resource:",
        asWebviewUri: (uri) => uri,
        onDidReceiveMessage: (listener) => {
          receiveMessage = listener;
          if (automaticReady) {
            queueMicrotask(() => receiveMessage({ type: "ready" }));
          }
        },
        postMessage: async (message) => {
          postedMessages.push(message);
          if (message.type === "choose") {
            queueMicrotask(() =>
              receiveMessage({
                type: "destination",
                choiceId: message.choiceId,
                kind: unsupported ? "unsupported" : "local",
                token: "browser-file-token",
                fileName: "work.table.csv",
                error: unsupported
                  ? "Local file selection is unsupported."
                  : undefined,
              }),
            );
          } else if (message.type === "write") {
            activeWrites++;
            maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
            writes.push(message);
            await new Promise((resolve) => setTimeout(resolve, 10));
            activeWrites--;
            receiveMessage({
              type: "ack",
              requestId: message.requestId,
              ok: !rejectWrite,
              error: rejectWrite ? "Browser write failed" : undefined,
            });
          } else if (message.type === "abort") {
            writes.push(message);
          } else if (message.requestId) {
            receiveMessage({
              type: "ack",
              requestId: message.requestId,
              ok: true,
            });
          }
          return true;
        },
      },
      onDidDispose: (listener) => {
        const previous = onDispose;
        onDispose = () => {
          previous();
          listener();
        };
      },
      onDidChangeViewState: (listener) => {
        const previous = onViewState;
        onViewState = (event) => {
          previous(event);
          listener(event);
        };
      },
      reveal: (viewColumn, preserveFocus) =>
        revealCalls.push([viewColumn, preserveFocus]),
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        onDispose();
      },
    };
    createWebviewPanelStub = sandbox
      .stub(window, "createWebviewPanel")
      // The test panel supplies only the webview lifecycle used by this bridge.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .returns(panel as unknown as WebviewPanel);
    sandbox
      .stub(window, "registerWebviewPanelSerializer")
      .callsFake((_viewType, value) => {
        serializer = value;
        return new Disposable(() => {});
      });
    target = new BrowserFileDownloadTarget(
      Uri.file("/extension"),
      new WebViewManager(),
    );
  });

  afterEach(() => {
    target.dispose();
    sandbox.restore();
  });

  async function chooseFile() {
    return target.chooseLocalFile("work.table.csv", "WORK.TABLE");
  }

  it("preserves default panel placement and focus behavior for existing webviews", () => {
    const manager = new WebViewManager();
    manager.render(
      new TestWebView(Uri.file("/extension"), "Existing"),
      "table",
    );

    expect(createWebviewPanelStub.firstCall.args[0]).to.equal("webView");
    expect(createWebviewPanelStub.firstCall.args[1]).to.equal("table");
    expect(createWebviewPanelStub.firstCall.args[2]).to.deep.equal({
      viewColumn: ViewColumn.One,
      preserveFocus: true,
    });
    expect(createWebviewPanelStub.firstCall.args[3]).to.deep.equal({
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    expect(panel.webview.options).to.deep.include({
      enableScripts: true,
      enableForms: true,
    });

    manager.render(
      new TestWebView(Uri.file("/extension"), "Replacement"),
      "table",
    );
    expect(createWebviewPanelStub.calledOnce).to.equal(true);
    expect(revealCalls).to.deep.equal([[ViewColumn.One, true]]);

    manager.render(
      new TestWebView(Uri.file("/extension"), "Replacement"),
      "table",
      true,
    );
    expect(createWebviewPanelStub.calledOnce).to.equal(true);
    expect(panel.webview.html).to.include("<title>Replacement</title>");
    expect(revealCalls).to.deep.equal([
      [ViewColumn.One, true],
      [ViewColumn.One, true],
    ]);
  });

  it("opens Browser File Download beside the current view and focuses it", async () => {
    await chooseFile();

    expect(createWebviewPanelStub.firstCall.args[0]).to.equal(
      "sasBrowserFileDownload",
    );
    expect(createWebviewPanelStub.firstCall.args[2]).to.deep.equal({
      viewColumn: ViewColumn.Beside,
      preserveFocus: false,
    });
    expect(revealCalls).to.deep.equal([[ViewColumn.Beside, false]]);

    panel.active = false;
    onViewState({ webviewPanel: panel });
    expect(postedMessages).to.deep.include({
      command: "panel:changeFocus",
      data: { focused: false },
    });
  });

  it("deserializes only safe labels and converts active exports to interrupted", () => {
    expect(
      deserializeBrowserDownloadWebviewState({
        tableName: "WORK.TABLE",
        fileName: "work.table.csv",
        result: "inProgress",
        path: "/private/work.table.csv",
        credential: "secret",
        progress: 0.75,
        transferId: "transfer",
      }),
    ).to.deep.equal({
      tableName: "WORK.TABLE",
      fileName: "work.table.csv",
      result: "interrupted",
    });
    expect(
      deserializeBrowserDownloadWebviewState({
        tableName: "WORK.TABLE",
        fileName: "work.table.csv",
        result: "unknown",
      }),
    ).to.equal(undefined);
  });

  it("restores the webview through the serializer with sanitized state", async () => {
    if (!serializer) {
      throw new Error("The browser download serializer was not registered.");
    }

    await serializer.deserializeWebviewPanel(panel as unknown as WebviewPanel, {
      tableName: "WORK.TABLE",
      fileName: "work.table.csv",
      result: "inProgress",
      transferId: "must-not-be-restored",
    });

    expect(panel.webview.options.enableScripts).to.equal(true);
    expect(panel.webview.options.enableForms).to.equal(true);
    expect(postedMessages).to.deep.include({
      type: "restore",
      state: {
        tableName: "WORK.TABLE",
        fileName: "work.table.csv",
        result: "interrupted",
      },
    });
  });

  it("returns from deserialization before the restored webview is ready", async () => {
    if (!serializer) {
      throw new Error("The browser download serializer was not registered.");
    }

    automaticReady = false;
    const deserialization = serializer
      .deserializeWebviewPanel(panel as unknown as WebviewPanel, {
        tableName: "WORK.TABLE",
        fileName: "work.table.csv",
        result: "completed",
      })
      .then(() => true);
    const completedBeforeReady = await Promise.race([
      deserialization,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20)),
    ]);

    expect(completedBeforeReady).to.equal(true);
    expect(
      postedMessages.some((message) => message.type === "restore"),
    ).to.equal(false);

    signalReady();

    expect(postedMessages).to.deep.include({
      type: "restore",
      state: {
        tableName: "WORK.TABLE",
        fileName: "work.table.csv",
        result: "completed",
      },
    });
  });

  it("streams bounded chunks one-at-a-time and waits for browser acknowledgements", async () => {
    const choice = await chooseFile();
    expect(choice.kind).to.equal("local");
    if (choice.kind !== "local") {
      throw new Error("Expected a local file destination.");
    }
    const destination = choice;
    expect(destination?.token).to.equal("browser-file-token");
    await target.open(destination.token, "transfer", destination.fileName);

    const source = Uint8Array.from(
      { length: 2 * MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES + 500 * 1024 },
      (_value, index) => index % 256,
    );
    await target.write("transfer", source, new AbortController().signal);

    const messages = writes.filter((message) => message.type === "write");
    expect(messages).to.have.length(3);
    expect(maximumActiveWrites).to.equal(1);
    const chunks = messages.map((message) => {
      expect(isUint8Array(message.data)).to.equal(true);
      if (!isUint8Array(message.data)) {
        throw new Error("Browser download chunk was not a Uint8Array.");
      }
      const chunk = message.data;
      expect(message.byteLength).to.equal(chunk.byteLength);
      expect(chunk.byteLength).to.be.at.most(
        MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES,
      );
      expect(chunk.byteOffset).to.equal(0);
      expect(chunk.buffer.byteLength).to.equal(chunk.byteLength);
      return chunk;
    });
    expect(chunks.map((chunk) => chunk.byteLength)).to.deep.equal([
      MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES,
      MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES,
      500 * 1024,
    ]);
    expect(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    ).to.deep.equal(Buffer.from(source));
  });

  it("coalesces stream chunks and flushes the final partial chunk", async () => {
    const chunks: Uint8Array[] = [];
    const buffer = new BrowserDownloadChunkBuffer(4, async (chunk) => {
      chunks.push(new Uint8Array(chunk));
    });
    const signal = new AbortController().signal;

    await buffer.write(Uint8Array.of(1, 2), signal);
    expect(chunks).to.have.length(0);
    await buffer.write(Uint8Array.of(3, 4, 5), signal);
    await buffer.write(Uint8Array.of(6, 7, 8, 9, 10), signal);
    expect(chunks.map((chunk) => [...chunk])).to.deep.equal([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);

    await buffer.flush(signal);
    expect(chunks.map((chunk) => [...chunk])).to.deep.equal([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10],
    ]);
  });

  it("does not flush buffered data after cancellation", async () => {
    const chunks: Uint8Array[] = [];
    const buffer = new BrowserDownloadChunkBuffer(4, async (chunk) => {
      chunks.push(new Uint8Array(chunk));
    });
    const controller = new AbortController();
    await buffer.write(Uint8Array.of(1, 2), controller.signal);
    controller.abort(new Error("cancelled"));

    let failure: unknown;
    try {
      await buffer.flush(controller.signal);
    } catch (error) {
      failure = error;
    }
    expect(failure).to.equal(controller.signal.reason);
    expect(chunks).to.have.length(0);
  });

  it("pauses writes while hidden and resumes when the panel is shown", async () => {
    await chooseFile();
    const destination = { token: "browser-file-token", fileName: "table.csv" };
    await target.open(destination.token, "transfer", destination.fileName);
    panel.visible = false;
    onViewState({ webviewPanel: panel });

    const write = target.write(
      "transfer",
      new Uint8Array([1, 2, 3]),
      new AbortController().signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(writes.filter((message) => message.type === "write")).to.have.length(
      0,
    );

    panel.visible = true;
    onViewState({ webviewPanel: panel });
    await write;
    expect(writes.filter((message) => message.type === "write")).to.have.length(
      1,
    );
  });

  it("aborts a hidden export when its panel closes", async () => {
    await chooseFile();
    const controller = new AbortController();
    const closed = target.onDidClose(() =>
      controller.abort(new Error("panel closed")),
    );
    panel.visible = false;
    onViewState({ webviewPanel: panel });
    const write = target.write(
      "transfer",
      new Uint8Array([1]),
      controller.signal,
    );

    panel.dispose();
    closed.dispose();

    let failure: unknown;
    try {
      await write;
    } catch (error) {
      failure = error;
    }
    expect(failure).to.be.instanceOf(Error);
    expect(errorMessage(failure)).to.equal("panel closed");
  });

  it("surfaces browser writer failures", async () => {
    await chooseFile();
    rejectWrite = true;
    let failure: unknown;
    try {
      await target.write(
        "transfer",
        new Uint8Array([1]),
        new AbortController().signal,
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).to.be.instanceOf(Error);
    expect(errorMessage(failure)).to.equal("Browser write failed");
  });

  it("rejects binary message delivery when the webview cannot post the chunk", async () => {
    await chooseFile();
    sandbox.stub(panel.webview, "postMessage").callsFake(async (message) => {
      if (message.type === "write") {
        return false;
      }
      if (message.requestId) {
        queueMicrotask(() =>
          receiveMessage({
            type: "ack",
            requestId: message.requestId,
            ok: true,
          }),
        );
      }
      return true;
    });

    let failure: unknown;
    try {
      await target.write(
        "transfer",
        new Uint8Array([1]),
        new AbortController().signal,
      );
    } catch (error) {
      failure = error;
    }
    expect(errorMessage(failure)).to.equal(
      "Could not deliver a browser download chunk.",
    );
  });

  it("reports unsupported browser file-picker capabilities", async () => {
    unsupported = true;
    expect(await chooseFile()).to.deep.equal({ kind: "unsupported" });
  });

  it("renders React assets using the managed webview CSP", async () => {
    await chooseFile();

    expect(panel.webview.html).to.include('id="browser-download-root"');
    expect(panel.webview.html).to.include("BrowserDownloadApp.js");
    expect(panel.webview.html).to.include("BrowserDownloadApp.css");
    expect(panel.webview.html).to.include(
      "script-src vscode-webview-resource:",
    );
    expect(panel.webview.html).to.include("style-src vscode-webview-resource:");
    expect(panel.webview.html).not.to.include("'unsafe-inline'");
    expect(panel.webview.html).not.to.include("<script nonce=");
  });

  it("localizes the panel title and shares escaped strings through data-l10n", async () => {
    sandbox.stub(l10n, "t").callsFake((message) => `localized:${message}`);

    await chooseFile();

    expect(panel.title).to.equal("localized:Download Table: {tableName}");
    expect(panel.webview.html).to.include(
      "<title>localized:Download SAS Table to This Computer</title>",
    );
    expect(panel.webview.html).to.include(
      "localized:This browser does not support choosing a local file from this webview.",
    );
    expect(panel.webview.html).to.include(
      "localized:Permission for the selected file was revoked; select the destination again.",
    );
  });

  it("uses the typed Browser Download message map and preserves placeholders", () => {
    sandbox.stub(l10n, "t").callsFake((message) => `localized:${message}`);
    const webview = new BrowserDownloadWebview(
      Uri.file("/extension"),
      () => {},
    );

    const localizedMessages: BrowserDownloadLocalizedMessages =
      webview.l10nMessages();

    for (const message of Object.values(browserDownloadMessages)) {
      expect(localizedMessages[message]).to.equal(`localized:${message}`);
    }
    expect(localizedMessages[browserDownloadMessages.selectionFailed]).to.equal(
      "localized:Local file selection failed: {error}",
    );
    expect(localizedMessages[browserDownloadMessages.abortFailed]).to.equal(
      "localized:Abort also failed: {error}",
    );
  });

  it("escapes localized title and data-l10n content", async () => {
    sandbox.stub(l10n, "t").callsFake(() => "</script><script>&'");

    await chooseFile();

    expect(panel.webview.html).to.include(
      "<title>&lt;/script&gt;&lt;script&gt;&amp;&#39;</title>",
    );
    expect(panel.webview.html).not.to.include("</script><script>&'");
    expect(panel.webview.html).to.include(
      "&lt;/script&gt;&lt;script&gt;&amp;&#39;",
    );
  });

  it("uses package localization keys for the destination command titles", () => {
    const parsedManifest: unknown = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    const parsedPackageNls: unknown = JSON.parse(
      readFileSync(join(process.cwd(), "package.nls.json"), "utf8"),
    );
    if (!isCommandManifest(parsedManifest)) {
      throw new Error(
        "The package manifest has invalid command contributions.",
      );
    }
    if (!isStringRecord(parsedPackageNls)) {
      throw new Error("The package localization file has invalid entries.");
    }
    const commandKeys = [
      [
        "SAS.downloadTableRemoteWorkspace",
        "commands.SAS.downloadTableRemoteWorkspace",
      ],
      ["SAS.downloadTableToComputer", "commands.SAS.downloadTableToComputer"],
    ];

    for (const [command, key] of commandKeys) {
      const contribution = parsedManifest.contributes.commands.find(
        (item) => item.command === command,
      );
      expect(contribution?.title).to.equal(`%${key}%`);
      expect(parsedPackageNls[key]).to.be.a("string").and.not.empty;
    }
  });

  it("aborts an in-flight browser write when canceled", async () => {
    await chooseFile();
    const controller = new AbortController();
    const write = target.write(
      "transfer",
      new Uint8Array([1]),
      controller.signal,
    );
    setTimeout(() => controller.abort(new Error("canceled")), 1);

    let failure: unknown;
    try {
      await write;
    } catch (error) {
      failure = error;
    }
    expect(errorMessage(failure)).to.equal("canceled");
    expect(writes.some((message) => message.type === "abort")).to.equal(true);
  });
});
